import { Editor, type OnMount } from "@monaco-editor/react";
import { type TaskCode } from "@/lib/helpers/getTasks";
import { useState, useMemo, useRef } from "react";
import { useAuth } from "@/lib/ctx/useAuth";
import { useNavigate } from "react-router";
import SubmitButton from "./SubmitButton";
import { getCustomCourses, clearCustomData } from "@/lib/helpers/adminStorage";
import { generateCourseZip } from "@/lib/helpers/zipGenerator";
import { getLessonTasksSync } from "@/lib/helpers/getTasks";
import { Plus } from "lucide-react";
import "@/styles/editor.css";
import * as monaco from "monaco-editor";

export interface EditorPaneProps {
  task: Partial<TaskCode>;
  currentIndex: number;
  totalTasks: number;
  onTaskChange: (field: keyof Partial<TaskCode>, value: string) => void;
  onChangeTask: (index: number) => void;
  readonlyHtml?: string;
  readonlyCss?: string;
  readonlyJs?: string;
  onSubmit: () => Promise<void>;
  completedTasks?: Set<string>;
  currentTaskId?: string;
  isAdmin?: boolean;
  onAddTask?: () => void;
  lessonSlug?: string;
}

type Tab = "html" | "css" | "js";

export default function EditorPane({
  task,
  currentIndex,
  totalTasks,
  onTaskChange,
  onChangeTask,
  readonlyHtml = "",
  readonlyCss = "",
  readonlyJs = "",
  onSubmit,
  completedTasks,
  currentTaskId,
  isAdmin,
  onAddTask,
  lessonSlug,
}: EditorPaneProps) {
  const [activeTab, setActiveTab] = useState<Tab>("html");
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const navigate = useNavigate();

  const { user } = useAuth();

  const showSubmitButton = user && user.role !== "admin";

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < totalTasks - 1;

  const onPrev = () => {
    if (hasPrev) onChangeTask(currentIndex - 1);
  };

  const onNext = () => {
    if (hasNext) onChangeTask(currentIndex + 1);
  };

  const handleDownloadZip = async () => {
    if (!lessonSlug) return;

    const courses = getCustomCourses();
    const course = courses.find((c) => c.slug === lessonSlug);
    if (!course) {
      return;
    }

    const tasks = getLessonTasksSync(lessonSlug);
    await generateCourseZip(course, tasks);

    clearCustomData(lessonSlug);
    navigate("/admin");
  };

  const content = useMemo(() => {
    const r =
      activeTab === "html"
        ? readonlyHtml
        : activeTab === "css"
          ? readonlyCss
          : readonlyJs;
    const e =
      activeTab === "html"
        ? task?.editableHtml
        : activeTab === "css"
          ? task?.editableCss
          : task?.editableJs;
    return (r || "") + (e || "");
  }, [activeTab, readonlyHtml, readonlyCss, readonlyJs, task]);

  const readonlyLinesCount = useMemo(() => {
    const r =
      activeTab === "html"
        ? readonlyHtml
        : activeTab === "css"
          ? readonlyCss
          : readonlyJs;
    if (!r) return 0;
    return r.split("\n").length;
  }, [activeTab, readonlyHtml, readonlyCss, readonlyJs]);

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    updateDecorations(editor, monacoInstance, readonlyLinesCount);
  };

  const updateDecorations = (
    editor: monaco.editor.IStandaloneCodeEditor,
    monaco: typeof import("monaco-editor"),
    lines: number,
  ) => {
    if (!editor) return;
    const model = editor.getModel();
    if (!model || lines <= 0) {
      editor.deltaDecorations([], []);
      return;
    }

    editor.deltaDecorations(
      [],
      [
        {
          range: new monaco.Range(1, 1, lines, 1),
          options: {
            isWholeLine: true,
            className: "readonly-line",
            glyphMarginClassName: "readonly-glyph",
            hoverMessage: { value: "This section is read-only" },
            stickiness:
              monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        },
      ],
    );
  };

  const handleEditorChange = (value: string | undefined) => {
    const val = value || "";

    const r =
      activeTab === "html"
        ? readonlyHtml
        : activeTab === "css"
          ? readonlyCss
          : readonlyJs;
    const rText = r || "";

    if (!val.startsWith(rText)) {
      return;
    }

    const editablePart = val.slice(rText.length);

    const field =
      activeTab === "html"
        ? "editableHtml"
        : activeTab === "css"
          ? "editableCss"
          : "editableJs";

    onTaskChange(field, editablePart);
  };

  const isCompleted = currentTaskId && completedTasks?.has(currentTaskId);

  return (
    <div className="editor-pane">
      <div
        className="editor-tabs"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingRight: 10,
        }}
      >
        <div style={{ display: "flex" }}>
          <button
            className={activeTab === "html" ? "active" : ""}
            onClick={() => setActiveTab("html")}
          >
            HTML
          </button>
          <button
            className={activeTab === "css" ? "active" : ""}
            onClick={() => setActiveTab("css")}
          >
            CSS
          </button>
          <button
            className={activeTab === "js" ? "active" : ""}
            onClick={() => setActiveTab("js")}
          >
            JS
          </button>
        </div>
      </div>

      <div className="editor-container" style={{ flex: 1 }}>
        <Editor
          key={activeTab}
          height="100%"
          defaultLanguage={activeTab === "js" ? "javascript" : activeTab}
          language={activeTab === "js" ? "javascript" : activeTab}
          value={content}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            padding: { top: 16 },
            scrollBeyondLastLine: false,
          }}
        />
      </div>

      <div className="task-navigation">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={hasPrev ? onPrev : undefined}
            disabled={!hasPrev}
            className="btn-ghost"
          >
            ← Previous
          </button>
          <span>
            Task {currentIndex + 1} of {totalTasks} {isCompleted && "✅"}
          </span>
          <button
            onClick={hasNext ? onNext : undefined}
            disabled={!hasNext}
            className="btn-ghost"
          >
            Next →
          </button>
          {isAdmin && (
            <button
              onClick={onAddTask}
              className="btn-primary"
              title="Add Task"
              style={{ padding: 4, display: "flex", alignItems: "center" }}
            >
              <Plus size={18} />
            </button>
          )}
        </div>

        {showSubmitButton && <SubmitButton onClick={onSubmit} />}

        {isAdmin && (
          <button
            onClick={handleDownloadZip}
            className="btn-primary"
            style={{ padding: "8px 16px" }}
          >
            Download Zip
          </button>
        )}
      </div>
    </div>
  );
}
