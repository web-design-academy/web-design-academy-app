import { useEffect, useState, useMemo, useRef } from "react";
import MonacoEditor, { type OnMount } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { TaskCode } from "@/lib/helpers/getTasks";

import "@/styles/editor.css";

type EditorLanguage = "html" | "css" | "javascript";

interface EditorPaneProps {
  task: Partial<TaskCode>;
  currentIndex: number;
  totalTasks: number;
  onTaskChange: (field: keyof TaskCode, value: string) => void;
  onChangeTask: (idx: number) => void;

  readonlyHtml?: string;
  readonlyCss?: string;
  readonlyJs?: string;
}

export default function EditorPane({
  task,
  currentIndex,
  totalTasks,
  onTaskChange,
  onChangeTask,

  readonlyHtml = "",
  readonlyCss = "",
  readonlyJs = "",
}: EditorPaneProps) {
  const [tab, setTab] = useState<EditorLanguage>("html");

  const [theme, setTheme] = useState<"vs-dark" | "light">(
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "vs-dark"
      : "light",
  );

  const editorRefs = useRef<
    Record<EditorLanguage, monaco.editor.IStandaloneCodeEditor | null>
  >({
    html: null,
    css: null,
    javascript: null,
  });

  useEffect(() => {
    const stored = localStorage.getItem("preferred-theme");
    setTheme(stored === "dark" ? "vs-dark" : "light");

    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      setTheme(currentTheme === "dark" ? "vs-dark" : "light");
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  const combinedModels: Record<
    EditorLanguage,
    { readonly: string; editable: string }
  > = useMemo(
    () => ({
      html: {
        readonly: readonlyHtml || "",
        editable: task.editableHtml || "",
      },
      css: {
        readonly: readonlyCss || "",
        editable: task.editableCss || "",
      },
      javascript: {
        readonly: readonlyJs || "",
        editable: task.editableJs || "",
      },
    }),
    [task, readonlyHtml, readonlyCss, readonlyJs],
  );

  function buildValue(lang: EditorLanguage) {
    const m = combinedModels[lang];
    return m.readonly + m.editable;
  }

  const handleMount: OnMount = (editor, monacoInstance) => {
    const lang = editor.getModel()?.getLanguageId() as EditorLanguage;
    if (!lang) return;

    editorRefs.current[lang] = editor;

    const readonly = combinedModels[lang].readonly;
    if (!readonly) return;

    const readonlyLines = readonly.split("\n").length;

    editor.deltaDecorations(
      [],
      [
        {
          range: new monacoInstance.Range(1, 1, readonlyLines, 1),
          options: {
            isWholeLine: true,
            className: "readonly-line",
            stickiness:
              monacoInstance.editor.TrackedRangeStickiness
                .NeverGrowsWhenTypingAtEdges,
          },
        },
      ],
    );
  };

  function handleChange(lang: EditorLanguage, val: string) {
    const readonly = combinedModels[lang].readonly;
    const editable = val.slice(readonly.length);
    onTaskChange(getField(lang), editable);
  }

  function getField(lang: EditorLanguage): keyof TaskCode {
    if (lang === "html") return "editableHtml";
    if (lang === "css") return "editableCss";
    return "editableJs";
  }

  const languages: EditorLanguage[] = ["html", "css", "javascript"];

  return (
    <div className="editor-pane">
      <div className="task-navigation">
        <button
          disabled={currentIndex === 0}
          onClick={() => onChangeTask(currentIndex - 1)}
        >
          Previous
        </button>
        <span>
          Task {currentIndex + 1} / {totalTasks}
        </span>
        <button
          disabled={currentIndex === totalTasks - 1}
          onClick={() => onChangeTask(currentIndex + 1)}
        >
          Next
        </button>
      </div>

      <div className="editor-tabs">
        {languages.map((l) => (
          <button
            key={l}
            onClick={() => setTab(l)}
            className={tab === l ? "active" : ""}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, display: "flex" }}>
        {languages.map((l) => (
          <div
            key={l}
            style={{
              display: tab === l ? "block" : "none",
              width: "100%",
            }}
          >
            <MonacoEditor
              loading={<LoadingSpinner />}
              height="100%"
              defaultLanguage={l}
              theme={theme}
              value={buildValue(l)}
              onMount={handleMount}
              onChange={(val) => handleChange(l, val ?? "")}
              options={{
                minimap: { enabled: false },
                scrollbar: { vertical: "auto", horizontal: "auto" },
                wordWrap: "on",
                fontSize: 14,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
