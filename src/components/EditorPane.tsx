import { useEffect, useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { TaskCode } from "@/lib/helpers/getTasks";

import "@/styles/editor.css";

interface EditorPaneProps {
  task: Partial<TaskCode>;
  currentIndex: number;
  totalTasks: number;
  onTaskChange: (field: keyof TaskCode, value: string) => void;
  onChangeTask: (idx: number) => void;
}

export default function EditorPane({
  task,
  currentIndex,
  totalTasks,
  onTaskChange,
  onChangeTask,
}: EditorPaneProps) {
  const [tab, setTab] = useState<"html" | "css" | "javascript">("html");
  const [theme, setTheme] = useState<"vs-dark" | "light">(
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "vs-dark"
      : "light",
  );

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
        {(["html", "css", "javascript"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? "active" : ""}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, display: "flex" }}>
        {(["html", "css", "javascript"] as const).map((t) => (
          <div
            key={t}
            style={{ display: tab === t ? "block" : "none", width: "100%" }}
          >
            <MonacoEditor
              loading={<LoadingSpinner />}
              height="100%"
              defaultLanguage={t}
              theme={theme}
              value={
                t === "html"
                  ? task.editableHtml
                  : t === "css"
                    ? task.editableCss
                    : task.editableJs
              }
              onChange={(val) =>
                t === "html"
                  ? onTaskChange("editableHtml", val ?? "")
                  : t === "css"
                    ? onTaskChange("editableCss", val ?? "")
                    : onTaskChange("editableJs", val ?? "")
              }
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
