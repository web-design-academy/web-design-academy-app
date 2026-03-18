import { Editor, type OnMount } from "@monaco-editor/react";
import { type TaskCode } from "@/lib/helpers/getTasks";
import { useState, useMemo, useRef } from "react";
import { useAuth } from "@/lib/ctx/useAuth";
import { useNavigate } from "react-router";
import SubmitButton from "./SubmitButton";
import { getCustomCourses, clearCustomData } from "@/lib/helpers/adminStorage";
import { generateCourseZip } from "@/lib/helpers/zipGenerator";
import { getLessonTasksSync } from "@/lib/helpers/getTasks";
import "@/styles/editor.css";
import * as monaco from "monaco-editor";
import { ArrowLeft, ArrowRight, Check, Download, Plus } from "lucide-react";
import { useTheme } from "@/lib/ctx/useTheme";

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
  onAddTask,
  lessonSlug,
}: EditorPaneProps) {
  const [activeTab, setActiveTab] = useState<Tab>("html");
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const navigate = useNavigate();
  const { theme } = useTheme()

  const { user } = useAuth();
  const isAdmin = user?.role === "admin"
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

  const handleDiscard = async () => {
    if (!lessonSlug) return;
    clearCustomData(lessonSlug);
    window.location.reload()
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
      <div className="editor-footer">
        {isAdmin && (
          <div className="footer-admin-row">
            <button onClick={onAddTask} className="btn-ghost">
              <Plus size={20} style={{ marginRight: 8 }} /> Add new task
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleDiscard} className="btn-ghost">
                Discard changes
              </button>
              <button onClick={handleDownloadZip} className="btn-primary">
                <Download size={20} style={{ marginRight: 8 }} /> Download archive
              </button>
            </div>
          </div>
        )}
        {showSubmitButton && (<div className="footer-student-row">
          <SubmitButton onClick={onSubmit} /></div>)}
      </div>

      <div className="editor-tabs">
        <button
          className={`tab ${activeTab === "html" ? "active" : ""}`}
          onClick={() => setActiveTab("html")}
        >
          index.html
        </button>
        <button
          className={`tab ${activeTab === "css" ? "active" : ""}`}
          onClick={() => setActiveTab("css")}
        >
          styles.css
        </button>
        <button
          className={`tab ${activeTab === "js" ? "active" : ""}`}
          onClick={() => setActiveTab("js")}
        >
          script.js
        </button>
      </div>

      <div className="editor-container">
        <Editor
          key={activeTab}
          height="100%"
          defaultLanguage={activeTab === "js" ? "javascript" : activeTab}
          language={activeTab === "js" ? "javascript" : activeTab}
          value={content}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          theme={theme === "dark" ? "vs-dark" : "vs-light"}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            padding: { top: 16 },
            scrollBeyondLastLine: false,
          }}
        />
      </div>

      <div className="footer-nav-row">
        <div className="nav-controls">
          <button
            onClick={hasPrev ? onPrev : undefined}
            disabled={!hasPrev}
            className="btn-ghost"
          >
            <ArrowLeft size={20} style={{ marginRight: 8 }} /> Previous
          </button>
          <span className="task-counter">
            Task {currentIndex + 1} of {totalTasks} {isCompleted && <Check size={20} style={{ marginLeft: 8 }} color="green" />}
          </span>
          <button
            onClick={hasNext ? onNext : undefined}
            disabled={!hasNext}
            className="btn-ghost"
          >
            Next <ArrowRight size={20} style={{ marginLeft: 8 }} />
          </button>
        </div>
      </div>
    </div>
  );
}
