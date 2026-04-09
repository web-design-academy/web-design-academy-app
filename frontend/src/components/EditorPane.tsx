import { Editor, type OnMount } from "@monaco-editor/react";
import { type TaskCode } from "@/lib/helpers/getTasks";
import { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/lib/ctx/useAuth";
import { useNavigate } from "react-router";
import SubmitButton from "./SubmitButton";
import { getCustomCourses, clearCustomData } from "@/lib/helpers/adminStorage";
import { generateCourseZip } from "@/lib/helpers/zipGenerator";
import { getLessonTasksSync } from "@/lib/helpers/getTasks";
import "@/styles/editor.css";
import * as monaco from "monaco-editor";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useTheme } from "@/lib/ctx/useTheme";
import VisualEditor from "visualeditor-html-css";

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
  onResetTask?: () => void;
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
  onResetTask,
  lessonSlug,
}: EditorPaneProps) {
  const [activeTab, setActiveTab] = useState<Tab>("html");
  const [useVisualEditor, setUseVisualEditor] = useState(false);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const lastValidValueRef = useRef("");
  const navigate = useNavigate();
  const { theme } = useTheme();

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
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
    window.location.reload();
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

  const editableSource =
    activeTab === "html"
      ? task?.editableHtml
      : activeTab === "css"
        ? task?.editableCss
        : task?.editableJs;

  const isFileFullyReadonly = editableSource === undefined;

  useEffect(() => {
    lastValidValueRef.current = content.replace(/\r\n/g, "\n");
  }, [content]);

  useEffect(() => {
    const editor = editorRef.current;
    const monacoInstance = monacoRef.current;

    if (!editor || !monacoInstance) {
      return;
    }

    const normalizedCurrent = editor.getValue().replace(/\r\n/g, "\n");
    const normalizedTarget = content.replace(/\r\n/g, "\n");

    if (normalizedCurrent !== normalizedTarget) {
      editor.setValue(content);
    }

    updateDecorations(editor, monacoInstance, readonlyLinesCount);
  }, [content, readonlyLinesCount]);

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
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
    const normalizedVal = val.replace(/\r\n/g, "\n");

    const r =
      activeTab === "html"
        ? readonlyHtml
        : activeTab === "css"
          ? readonlyCss
          : readonlyJs;
    const normalizedReadonly = (r || "").replace(/\r\n/g, "\n");

    if (isFileFullyReadonly) {
      const editor = editorRef.current;
      if (editor && editor.getValue().replace(/\r\n/g, "\n") !== lastValidValueRef.current) {
        editor.setValue(lastValidValueRef.current);
        if (monacoRef.current) {
          updateDecorations(editor, monacoRef.current, readonlyLinesCount);
        }
      }
      return;
    }

    if (!normalizedVal.startsWith(normalizedReadonly)) {
      const editor = editorRef.current;
      if (editor && editor.getValue().replace(/\r\n/g, "\n") !== lastValidValueRef.current) {
        editor.setValue(lastValidValueRef.current);
        if (monacoRef.current) {
          updateDecorations(editor, monacoRef.current, readonlyLinesCount);
        }
      }
      return;
    }

    const editablePart = normalizedVal.slice(normalizedReadonly.length);

    const field =
      activeTab === "html"
        ? "editableHtml"
        : activeTab === "css"
          ? "editableCss"
          : "editableJs";

    onTaskChange(field, editablePart);
    lastValidValueRef.current = normalizedVal;
  };

  const isCompleted = currentTaskId && completedTasks?.has(currentTaskId);

  return (
    <div className="editor-pane">
      <div className="editor-footer">
        {isAdmin && (
          <div className="footer-admin-row">
            <button onClick={onAddTask} className="btn-ghost">
              <Plus size={20} style={{ marginRight: 8 }} /> Add task
            </button>
            <div className="admin-actions-group">
              <button onClick={handleDiscard} className="btn-ghost">
                Discard
              </button>
              <button onClick={handleDownloadZip} className="btn-primary">
                <Download size={20} style={{ marginRight: 8 }} /> Download
              </button>
            </div>
          </div>
        )}
        {showSubmitButton && (
          <div className="footer-student-row">
            <SubmitButton onClick={onSubmit} />
          </div>
        )}
      </div>

      <div className="editor-tabs editor-tabs-row">
        <div className="editor-tab-list">
          <button
            className={`tab ${activeTab === "html" ? "active" : ""}`}
            onClick={() => setActiveTab("html")}
          >
            index.html
          </button>
          <button
            className={`tab ${activeTab === "css" ? "active" : ""}`}
            onClick={() => setActiveTab("css")}
            disabled={useVisualEditor}
            style={
              useVisualEditor ? { opacity: 0.3, cursor: "not-allowed" } : {}
            }
          >
            styles.css
          </button>
          <button
            className={`tab ${activeTab === "js" ? "active" : ""}`}
            onClick={() => setActiveTab("js")}
            disabled={useVisualEditor}
            style={
              useVisualEditor ? { opacity: 0.3, cursor: "not-allowed" } : {}
            }
          >
            script.js
          </button>
        </div>
        <div className="editor-tab-controls">
          <label className="visual-editor-toggle">
            <input
              type="checkbox"
              checked={useVisualEditor}
              onChange={(e) => setUseVisualEditor(e.target.checked)}
              className="visual-editor-checkbox"
            />
            Visual mode
          </label>
        </div>
      </div>

      <div className="editor-container">
        {useVisualEditor && (activeTab === "html" || activeTab === "css") ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            <VisualEditor
              content={task?.editableHtml || ""}
              setContent={(val: any) => onTaskChange("editableHtml", typeof val === 'function' ? val(task?.editableHtml || "") : val)}
              cssContent={task?.editableCss || ""}
              setCssContent={(val: any) => onTaskChange("editableCss", typeof val === 'function' ? val(task?.editableCss || "") : val)}
              isDark={theme === "dark"}
            />
          </div>
        ) : (
          <Editor
            key={`${activeTab}-${currentIndex}`}
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
              readOnly: isFileFullyReadonly,
              domReadOnly: isFileFullyReadonly,
            }}
          />
        )}
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
            Task {currentIndex + 1} of {totalTasks}
            {onResetTask && (
              <button
                onClick={onResetTask}
                className="task-reset-icon"
                title="Reset task"
                aria-label="Reset task"
              >
                <RotateCcw size={14} />
              </button>
            )}
            {isCompleted && (
              <Check size={20} style={{ marginLeft: 8 }} color="green" />
            )}
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
