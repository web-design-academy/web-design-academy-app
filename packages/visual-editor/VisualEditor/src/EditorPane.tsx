import { Editor, type OnMount } from "@monaco-editor/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Plus,
  RotateCcw,
} from "lucide-react";
import * as monaco from "monaco-editor";
import { useEffect, useMemo, useRef, useState } from "react";

import "./editor-pane.css";
import VisualEditor from "./VisualEditor/VisualEditor";

type TaskField = "editableHtml" | "editableCss" | "editableJs";
type Tab = "html" | "css" | "js";
type EditorMode = "code" | "visual";

export interface EditorTask {
  editableHtml?: string;
  editableCss?: string;
  editableJs?: string;
}

export interface EditorPaneProps {
  task: EditorTask;
  currentIndex: number;
  totalTasks: number;
  onTaskChange: (field: TaskField, value: string) => void;
  onChangeTask: (index: number) => void;
  readonlyHtml?: string;
  readonlyCss?: string;
  readonlyJs?: string;
  onSubmit?: () => Promise<void> | void;
  completedTasks?: Set<string>;
  currentTaskId?: string;
  onAddTask?: () => void;
  onResetTask?: () => void;
  canSubmit?: boolean;
  isAdmin?: boolean;
  isDark?: boolean;
  onDiscard?: () => void;
  onDownload?: () => void;
}

const getFirstPreferredTab = (task: EditorTask, readonly: EditorTask): Tab => {
  if (task.editableHtml !== undefined) return "html";
  if (task.editableCss !== undefined) return "css";
  if (task.editableJs !== undefined) return "js";

  if (readonly.editableHtml !== undefined) return "html";
  if (readonly.editableCss !== undefined) return "css";
  if (readonly.editableJs !== undefined) return "js";

  return "html";
};

export default function EditorPane({
  task,
  currentIndex,
  totalTasks,
  onTaskChange,
  onChangeTask,
  readonlyHtml,
  readonlyCss,
  readonlyJs,
  onSubmit,
  completedTasks,
  currentTaskId,
  onAddTask,
  onResetTask,
  canSubmit = false,
  isAdmin = false,
  isDark = false,
  onDiscard,
  onDownload,
}: EditorPaneProps) {
  const readonlyTask = {
    editableHtml: readonlyHtml,
    editableCss: readonlyCss,
    editableJs: readonlyJs,
  };

  const [activeTab, setActiveTab] = useState<Tab>(() =>
    getFirstPreferredTab(task, readonlyTask),
  );
  const [editorMode, setEditorMode] = useState<EditorMode>("code");
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(
    null,
  );
  const lastValidValueRef = useRef("");

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < totalTasks - 1;
  const hasEditableHtmlFile = task.editableHtml !== undefined;
  const hasEditableCssFile = task.editableCss !== undefined;
  const hasEditableJsFile = task.editableJs !== undefined;
  const hasHtmlSource = readonlyHtml !== undefined || hasEditableHtmlFile;
  const hasCssSource = readonlyCss !== undefined || hasEditableCssFile;
  const hasJsSource = readonlyJs !== undefined || hasEditableJsFile;

  const isHtmlTabDisabled = !hasHtmlSource;
  const isCssTabDisabled = !hasCssSource;
  const isJsTabDisabled = !hasJsSource;
  const preferredTab: Tab = hasEditableHtmlFile
    ? "html"
    : hasEditableCssFile
      ? "css"
      : hasEditableJsFile
        ? "js"
        : hasHtmlSource
          ? "html"
          : hasCssSource
            ? "css"
            : "js";

  const supportsVisualMode =
    hasEditableHtmlFile &&
    task.editableJs === undefined &&
    readonlyHtml === undefined &&
    readonlyCss === undefined &&
    readonlyJs === undefined;

  useEffect(() => {
    setActiveTab(preferredTab);
  }, [currentIndex, preferredTab]);

  useEffect(() => {
    if (activeTab === "html" && hasHtmlSource) return;
    if (activeTab === "css" && hasCssSource) return;
    if (activeTab === "js" && hasJsSource) return;
    setActiveTab(preferredTab);
  }, [activeTab, hasHtmlSource, hasCssSource, hasJsSource, preferredTab]);

  useEffect(() => {
    if (!supportsVisualMode && editorMode === "visual") {
      setEditorMode("code");
    }
  }, [editorMode, supportsVisualMode]);

  const content = useMemo(() => {
    const readonlyContent =
      activeTab === "html"
        ? readonlyHtml
        : activeTab === "css"
          ? readonlyCss
          : readonlyJs;
    const editableContent =
      activeTab === "html"
        ? task.editableHtml
        : activeTab === "css"
          ? task.editableCss
          : task.editableJs;

    return (readonlyContent || "") + (editableContent || "");
  }, [activeTab, readonlyHtml, readonlyCss, readonlyJs, task]);

  const readonlyLinesCount = useMemo(() => {
    const readonlyContent =
      activeTab === "html"
        ? readonlyHtml
        : activeTab === "css"
          ? readonlyCss
          : readonlyJs;

    return readonlyContent ? readonlyContent.split("\n").length : 0;
  }, [activeTab, readonlyHtml, readonlyCss, readonlyJs]);

  const editableSource =
    activeTab === "html"
      ? task.editableHtml
      : activeTab === "css"
        ? task.editableCss
        : task.editableJs;

  const isFileFullyReadonly = editableSource === undefined;
  const isCompleted = currentTaskId && completedTasks?.has(currentTaskId);

  useEffect(() => {
    lastValidValueRef.current = content.replace(/\r\n/g, "\n");
  }, [content]);

  const updateDecorations = (
    editor: monaco.editor.IStandaloneCodeEditor,
    monacoInstance: typeof monaco,
    lines: number,
  ) => {
    const model = editor.getModel();

    if (!model) {
      decorationsRef.current?.clear();
      return;
    }

    if (!decorationsRef.current) {
      decorationsRef.current = editor.createDecorationsCollection();
    }

    if (lines <= 0) {
      decorationsRef.current.clear();
      return;
    }

    decorationsRef.current.set([
      {
        range: new monacoInstance.Range(1, 1, lines, 1),
        options: {
          isWholeLine: true,
          className: "vep-readonly-line",
          hoverMessage: { value: "This section is read-only" },
          stickiness:
            monacoInstance.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      },
    ]);
  };

  useEffect(() => {
    const editor = editorRef.current;
    const monacoInstance = monacoRef.current;

    if (!editor || !monacoInstance || editorMode !== "code") {
      return;
    }

    const normalizedCurrent = editor.getValue().replace(/\r\n/g, "\n");
    const normalizedTarget = content.replace(/\r\n/g, "\n");

    if (normalizedCurrent !== normalizedTarget) {
      editor.setValue(content);
    }

    updateDecorations(editor, monacoInstance, readonlyLinesCount);
  }, [content, editorMode, readonlyLinesCount]);

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    updateDecorations(editor, monacoInstance, readonlyLinesCount);
  };

  const handleEditorChange = (value: string | undefined) => {
    const normalizedValue = (value || "").replace(/\r\n/g, "\n");
    const readonlyContent =
      activeTab === "html"
        ? readonlyHtml
        : activeTab === "css"
          ? readonlyCss
          : readonlyJs;
    const normalizedReadonly = (readonlyContent || "").replace(/\r\n/g, "\n");

    if (isFileFullyReadonly || !normalizedValue.startsWith(normalizedReadonly)) {
      const editor = editorRef.current;

      if (
        editor &&
        editor.getValue().replace(/\r\n/g, "\n") !== lastValidValueRef.current
      ) {
        editor.setValue(lastValidValueRef.current);

        if (monacoRef.current) {
          updateDecorations(editor, monacoRef.current, readonlyLinesCount);
        }
      }

      return;
    }

    const editablePart = normalizedValue.slice(normalizedReadonly.length);
    const field: TaskField =
      activeTab === "html"
        ? "editableHtml"
        : activeTab === "css"
          ? "editableCss"
          : "editableJs";

    onTaskChange(field, editablePart);
    lastValidValueRef.current = normalizedValue;
  };

  return (
    <div className="vep-root">
      <div className="vep-toolbar">
        <div className="vep-tab-list">
          <button
            className={`vep-tab ${activeTab === "html" ? "is-active" : ""}`}
            onClick={() => setActiveTab("html")}
            disabled={isHtmlTabDisabled}
            type="button"
          >
            index.html
          </button>
          <button
            className={`vep-tab ${activeTab === "css" ? "is-active" : ""}`}
            onClick={() => setActiveTab("css")}
            disabled={isCssTabDisabled}
            type="button"
          >
            styles.css
          </button>
          <button
            className={`vep-tab ${activeTab === "js" ? "is-active" : ""}`}
            onClick={() => setActiveTab("js")}
            disabled={isJsTabDisabled}
            type="button"
          >
            script.js
          </button>
        </div>

        <div className="vep-toolbar-actions">
          <div className="vep-mode-switcher" role="tablist" aria-label="Editor mode">
            <button
              className={`vep-mode-button ${editorMode === "code" ? "is-active" : ""}`}
              onClick={() => setEditorMode("code")}
              type="button"
            >
              Code
            </button>
            <button
              className={`vep-mode-button ${editorMode === "visual" ? "is-active" : ""}`}
              onClick={() => setEditorMode("visual")}
              disabled={!supportsVisualMode}
              title={
                supportsVisualMode
                  ? "Switch to the visual editor"
                  : "Visual mode is available only for fully editable HTML/CSS tasks"
              }
              type="button"
            >
              Visual
            </button>
          </div>

          {canSubmit && onSubmit && (
            <button className="vep-button vep-button-primary" onClick={() => void onSubmit()} type="button">
              Submit
            </button>
          )}
        </div>
      </div>

      <div className="vep-editor-body">
        {editorMode === "visual" && supportsVisualMode ? (
          <div className="vep-visual-surface">
            <VisualEditor
              content={task.editableHtml || ""}
              setContent={(value) => {
                const nextValue =
                  typeof value === "function" ? value(task.editableHtml || "") : value;
                onTaskChange("editableHtml", nextValue);
              }}
              cssContent={task.editableCss || ""}
              setCssContent={(value) => {
                const nextValue =
                  typeof value === "function" ? value(task.editableCss || "") : value;
                onTaskChange("editableCss", nextValue);
              }}
              isDark={isDark}
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
            theme={isDark ? "vs-dark" : "vs-light"}
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

      <div className="vep-footer-row">
        <button
          className="vep-button vep-button-ghost"
          onClick={hasPrev ? () => onChangeTask(currentIndex - 1) : undefined}
          disabled={!hasPrev}
          type="button"
        >
          <ArrowLeft size={18} />
          Previous
        </button>

        <span className="vep-task-counter">
          Task {currentIndex + 1} of {totalTasks}
          {onResetTask && (
            <button
              className="vep-inline-icon"
              onClick={onResetTask}
              title="Reset task"
              aria-label="Reset task"
              type="button"
            >
              <RotateCcw size={14} />
            </button>
          )}
          {isCompleted && <Check size={18} color="green" />}
        </span>

        <button
          className="vep-button vep-button-ghost"
          onClick={hasNext ? () => onChangeTask(currentIndex + 1) : undefined}
          disabled={!hasNext}
          type="button"
        >
          Next
          <ArrowRight size={18} />
        </button>
      </div>

      {isAdmin && (
        <div className="vep-admin-row">
          <button className="vep-button vep-button-ghost" onClick={onAddTask} type="button">
            <Plus size={18} />
            Add task
          </button>

          <div className="vep-admin-actions">
            {onDiscard && (
              <button className="vep-button vep-button-ghost" onClick={onDiscard} type="button">
                Discard
              </button>
            )}
            {onDownload && (
              <button
                className="vep-button vep-button-primary"
                onClick={onDownload}
                type="button"
              >
                <Download size={18} />
                Download
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
