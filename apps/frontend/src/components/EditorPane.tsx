import { Editor, type OnMount } from "@monaco-editor/react";
import {
  type CssEvaluationConfig,
  type TaskCode,
} from "@/lib/helpers/getTasks";
import type { AnalysisIssue } from "@wda/css-analysis";
import {
  useState,
  useMemo,
  useRef,
  useEffect,
  type ComponentType,
} from "react";
import { useAuth } from "@/lib/ctx/useAuth";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Play,
} from "lucide-react";
import SubmitButton from "./SubmitButton";
import LoadingSpinner from "./LoadingSpinner";
import "@/styles/editor.css";
import { useTheme } from "@/lib/ctx/useTheme";
import { useUiPreferences } from "@/lib/ctx/useUiPreferences";
import {
  canApplyStudentEdit,
  parseReadonlyRanges,
} from "@/lib/helpers/readonlyBlocks";

interface VisualEditorProps {
  html: string;
  css: string;
  onHtmlChange: (html: string) => void;
  onCssChange: (css: string) => void;
  isDark: boolean;
  canOverrideReadonly?: boolean;
}

export interface EditorPaneProps {
  task: Partial<TaskCode>;
  currentIndex: number;
  onTaskChange: (field: keyof Partial<TaskCode>, value: string) => void;
  onSubmit: () => Promise<boolean>;
  isSubmitted?: boolean;
  isSubmitDisabled?: boolean;
  submitDisabledTitle?: string;
  autosaveStatus?: "saved" | "saving" | "pending" | "error";
  autosaveLabelPrefix?: string;
  diagnostics?: AnalysisIssue[];
  focusRequest?: { line: number; nonce: number } | null;
  onEvaluationChange?: (evaluation: CssEvaluationConfig) => void;
  onEvaluate?: () => Promise<unknown>;
  isEvaluating?: boolean;
  evaluationEnabled?: boolean;
  visualEditorSupported?: boolean;
  onGenerateEvaluation?: () => Promise<CssEvaluationConfig>;
}

type Tab = "html" | "css" | "js" | "evaluation";
type MountedEditor = Parameters<OnMount>[0];
type MountedMonaco = Parameters<OnMount>[1];

const taskFieldByTab = {
  html: "html",
  css: "css",
  js: "js",
} as const;

const defaultEvaluation: CssEvaluationConfig = {
  version: 1,
  engine: "css",
  targetSelectors: [],
  checks: [],
  hintTimeoutSeconds: 60,
  pass: { minimumScore: 80, requireNoErrors: true },
};

const getFirstPreferredTab = (task: Partial<TaskCode>): Tab => {
  if (task.html !== undefined) return "html";
  if (task.css !== undefined) return "css";
  if (task.js !== undefined) return "js";

  return "html";
};

export default function EditorPane({
  task,
  currentIndex,
  onTaskChange,
  onSubmit,
  isSubmitted = false,
  isSubmitDisabled = false,
  submitDisabledTitle,
  autosaveStatus = "saved",
  autosaveLabelPrefix = "Work",
  diagnostics = [],
  focusRequest = null,
  onEvaluationChange,
  onEvaluate,
  isEvaluating = false,
  evaluationEnabled = false,
  visualEditorSupported = false,
  onGenerateEvaluation,
}: EditorPaneProps) {
  const [activeTab, setActiveTab] = useState<Tab>(() =>
    getFirstPreferredTab(task),
  );
  const [evaluationDraft, setEvaluationDraft] = useState(() =>
    JSON.stringify(task.evaluation ?? defaultEvaluation, null, 2),
  );
  const editorRef = useRef<MountedEditor | null>(null);
  const monacoRef = useRef<MountedMonaco | null>(null);
  const decorationsRef = useRef<ReturnType<
    MountedEditor["createDecorationsCollection"]
  > | null>(null);
  const lastValidValueRef = useRef("");
  const isRestoringRef = useRef(false);
  const readonlyRangesRef = useRef<{ startLine: number; endLine: number }[]>(
    [],
  );
  const editorStateRef = useRef({
    activeTab,
    isAdmin: false,
    isReadonly: false,
    onTaskChange,
    onEvaluationChange,
  });
  const [VisualEditorComponent, setVisualEditorComponent] =
    useState<ComponentType<VisualEditorProps> | null>(null);
  const { theme } = useTheme();
  const { visualEditorEnabled, setVisualEditorAvailable } = useUiPreferences();

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const showSubmitButton = user && user.role !== "admin";

  const hasHtmlSource = task.html !== undefined;
  const hasCssSource = task.css !== undefined;
  const hasJsSource = task.js !== undefined;

  const isHtmlTabDisabled = !isAdmin && !hasHtmlSource;
  const isCssTabDisabled = !isAdmin && !hasCssSource;
  const isJsTabDisabled = !isAdmin && !hasJsSource;
  const preferredTab: Tab = hasHtmlSource
    ? "html"
    : hasCssSource
      ? "css"
      : hasJsSource
        ? "js"
        : "html";
  const visualEditorAvailable =
    visualEditorSupported && (hasHtmlSource || hasCssSource) && !hasJsSource;
  const showVisualEditor =
    visualEditorEnabled &&
    visualEditorAvailable &&
    activeTab !== "js" &&
    activeTab !== "evaluation";
  const autosaveMeta = {
    saved: {
      label: `${autosaveLabelPrefix} saved`,
      Icon: CheckCircle2,
    },
    saving: {
      label: "Saving...",
      Icon: LoaderCircle,
    },
    pending: {
      label: "Autosave queued",
      Icon: Clock3,
    },
    error: {
      label: "Autosave failed",
      Icon: AlertTriangle,
    },
  }[autosaveStatus];
  const AutosaveIcon = autosaveMeta.Icon;

  useEffect(() => {
    setVisualEditorAvailable(visualEditorAvailable);

    return () => {
      setVisualEditorAvailable(false);
    };
  }, [setVisualEditorAvailable, visualEditorAvailable]);

  useEffect(() => {
    if (showVisualEditor) {
      Promise.all([
        import("@wda/visual-editor"),
        import("@wda/visual-editor/style.css"),
      ])
        .then(([module]) => {
          setVisualEditorComponent(() => module.VisualEditor);
        })
        .catch((err) => {
          console.error("Failed to load visual editor:", err);
        });
    }
  }, [showVisualEditor]);

  useEffect(() => {
    setActiveTab(preferredTab);
    setEvaluationDraft(
      JSON.stringify(task.evaluation ?? defaultEvaluation, null, 2),
    );
  }, [currentIndex, preferredTab, task.evaluation]);

  useEffect(() => {
    if (activeTab === "html" && (isAdmin || hasHtmlSource)) return;
    if (activeTab === "css" && (isAdmin || hasCssSource)) return;
    if (activeTab === "js" && (isAdmin || hasJsSource)) return;
    if (activeTab === "evaluation" && isAdmin) return;
    setActiveTab(preferredTab);
  }, [
    activeTab,
    hasHtmlSource,
    hasCssSource,
    hasJsSource,
    isAdmin,
    preferredTab,
  ]);

  const content = useMemo(() => {
    if (activeTab === "evaluation") return evaluationDraft;
    return task[taskFieldByTab[activeTab]] ?? "";
  }, [activeTab, evaluationDraft, task]);

  const readonlyRanges = useMemo(() => {
    if (activeTab === "evaluation") return [];
    try {
      return parseReadonlyRanges(content, activeTab);
    } catch {
      return [];
    }
  }, [activeTab, content]);

  const hasInvalidReadonlyMarkers = useMemo(() => {
    if (isAdmin) return false;
    if (activeTab === "evaluation") return false;

    try {
      parseReadonlyRanges(content, activeTab);
      return false;
    } catch {
      return true;
    }
  }, [activeTab, content, isAdmin]);

  const isTaskDeleted = Boolean(task.deleted);
  const isEditorReadonly = isTaskDeleted || hasInvalidReadonlyMarkers;

  readonlyRangesRef.current = readonlyRanges;
  editorStateRef.current = {
    activeTab,
    isAdmin,
    isReadonly: isEditorReadonly,
    onTaskChange,
    onEvaluationChange,
  };

  useEffect(() => {
    lastValidValueRef.current = content.replace(/\r\n/g, "\n");
  }, [content]);

  useEffect(() => {
    const editor = editorRef.current;
    const monacoInstance = monacoRef.current;

    if (!editor || !monacoInstance || showVisualEditor) {
      return;
    }

    const normalizedCurrent = editor.getValue().replace(/\r\n/g, "\n");
    const normalizedTarget = content.replace(/\r\n/g, "\n");

    if (normalizedCurrent !== normalizedTarget) {
      isRestoringRef.current = true;
      editor.setValue(content);
      isRestoringRef.current = false;
    }

    updateDecorations(editor, monacoInstance, readonlyRanges);
  }, [content, readonlyRanges, showVisualEditor]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model || showVisualEditor) return;

    monaco.editor.setModelMarkers(
      model,
      "task-evaluation",
      activeTab === "css"
        ? diagnostics.map((issue) => ({
            startLineNumber: Math.max(1, issue.lineNumber || 1),
            startColumn: 1,
            endLineNumber: Math.max(1, issue.lineNumber || 1),
            endColumn: model.getLineMaxColumn(
              Math.min(
                model.getLineCount(),
                Math.max(1, issue.lineNumber || 1),
              ),
            ),
            severity:
              issue.level === "error"
                ? monaco.MarkerSeverity.Error
                : issue.level === "warning"
                  ? monaco.MarkerSeverity.Warning
                  : monaco.MarkerSeverity.Info,
            message: issue.message || issue.messageCode,
            code: issue.messageCode,
          }))
        : [],
    );
  }, [activeTab, diagnostics, showVisualEditor]);

  useEffect(() => {
    if (!focusRequest) return;
    setActiveTab("css");
    window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const lineNumber = Math.max(1, focusRequest.line);
      editor.revealLineInCenter(lineNumber);
      editor.setPosition({ lineNumber, column: 1 });
      editor.focus();
    });
  }, [focusRequest]);

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    lastValidValueRef.current = editor.getValue().replace(/\r\n/g, "\n");
    decorationsRef.current?.clear();
    decorationsRef.current = editor.createDecorationsCollection();
    updateDecorations(editor, monacoInstance, readonlyRanges);

    editor.onDidChangeModelContent((event) => {
      if (isRestoringRef.current) return;

      const model = editor.getModel();
      if (!model) return;

      const nextValue = model.getValue().replace(/\r\n/g, "\n");
      const {
        activeTab: currentTab,
        isAdmin: currentIsAdmin,
        isReadonly,
        onTaskChange: commitTaskChange,
        onEvaluationChange: commitEvaluationChange,
      } = editorStateRef.current;

      if (currentTab === "evaluation") {
        lastValidValueRef.current = nextValue;
        setEvaluationDraft(nextValue);
        try {
          const parsed = JSON.parse(nextValue) as CssEvaluationConfig;
          if (
            parsed.version === 1 &&
            parsed.engine === "css" &&
            Array.isArray(parsed.targetSelectors) &&
            Array.isArray(parsed.checks)
          ) {
            commitEvaluationChange?.(parsed);
          }
        } catch {
          // Monaco keeps the incomplete JSON draft and reports its syntax errors.
        }
        return;
      }

      const touchesReadonlyLine = event.changes.some((change) =>
        readonlyRangesRef.current.some(
          (range) =>
            change.range.startLineNumber <= range.endLine &&
            change.range.endLineNumber >= range.startLine,
        ),
      );
      const editIsAllowed =
        currentIsAdmin ||
        (!isReadonly &&
          !touchesReadonlyLine &&
          canApplyStudentEdit(
            lastValidValueRef.current,
            nextValue,
            currentTab,
          ));

      if (!editIsAllowed) {
        const attemptedPosition = editor.getPosition();
        isRestoringRef.current = true;
        model.setValue(lastValidValueRef.current);
        if (attemptedPosition) editor.setPosition(attemptedPosition);
        isRestoringRef.current = false;
        updateDecorations(editor, monacoInstance, readonlyRangesRef.current);
        return;
      }

      lastValidValueRef.current = nextValue;
      commitTaskChange(taskFieldByTab[currentTab], nextValue);
    });
  };

  const updateDecorations = (
    editor: MountedEditor,
    monaco: MountedMonaco,
    ranges: { startLine: number; endLine: number }[],
  ) => {
    const model = editor.getModel();
    if (!model) {
      decorationsRef.current?.clear();
      return;
    }

    if (!decorationsRef.current) {
      decorationsRef.current = editor.createDecorationsCollection();
    }

    decorationsRef.current.set(
      ranges.map((range) => ({
        range: new monaco.Range(range.startLine, 1, range.endLine, 1),
        options: {
          isWholeLine: true,
          className: "readonly-line-highlight",
          glyphMarginClassName: "readonly-glyph",
          inlineClassName: "locked-text-inline",
          glyphMarginHoverMessage: { value: "This section is read-only" },
          stickiness:
            monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      })),
    );
  };

  return (
    <div className={`editor-pane ${isTaskDeleted ? "is-task-deleted" : ""}`}>
      <div className="editor-tabs editor-tabs-row">
        <div className="editor-tab-list">
          <button
            className={`tab ${activeTab === "html" ? "active" : ""}`}
            onClick={() => setActiveTab("html")}
            disabled={isHtmlTabDisabled}
            style={
              isHtmlTabDisabled ? { opacity: 0.3, cursor: "not-allowed" } : {}
            }
          >
            index.html
          </button>
          <button
            className={`tab ${activeTab === "css" ? "active" : ""}`}
            onClick={() => setActiveTab("css")}
            disabled={isCssTabDisabled}
            style={
              isCssTabDisabled ? { opacity: 0.3, cursor: "not-allowed" } : {}
            }
          >
            styles.css
          </button>
          <button
            className={`tab ${activeTab === "js" ? "active" : ""}`}
            onClick={() => setActiveTab("js")}
            disabled={isJsTabDisabled}
            style={
              isJsTabDisabled ? { opacity: 0.3, cursor: "not-allowed" } : {}
            }
          >
            script.js
          </button>
          {isAdmin && (
            <button
              className={`tab ${activeTab === "evaluation" ? "active" : ""}`}
              onClick={() => setActiveTab("evaluation")}
              title="Machine-readable task evaluation"
            >
              evaluation.json
            </button>
          )}
        </div>
        <div className="editor-tab-controls">
          {activeTab === "evaluation" && onGenerateEvaluation && (
            <button
              type="button"
              className="editor-evaluate-button"
              onClick={() =>
                void onGenerateEvaluation().then((evaluation) => {
                  setEvaluationDraft(JSON.stringify(evaluation, null, 2));
                })
              }
              disabled={!task.solutionCss}
              title="Generate checks from solution.css"
            >
              <Play size={15} fill="currentColor" />
              <span>Generate from solution</span>
            </button>
          )}
          {evaluationEnabled && onEvaluate && activeTab !== "evaluation" && (
            <button
              type="button"
              className="editor-evaluate-button"
              onClick={() => {
                setActiveTab("css");
                void onEvaluate();
              }}
              disabled={isEvaluating}
              title="Evaluate the current solution"
            >
              {isEvaluating ? (
                <LoaderCircle size={15} className="autosave-spin-icon" />
              ) : (
                <Play size={15} fill="currentColor" />
              )}
              <span>{isEvaluating ? "Evaluating…" : "Evaluate"}</span>
            </button>
          )}
          {showSubmitButton && (
            <SubmitButton
              onClick={onSubmit}
              isSubmitted={isSubmitted}
              disabled={isSubmitDisabled}
              disabledTitle={submitDisabledTitle}
            />
          )}
        </div>
      </div>

      <div className="editor-container">
        {showVisualEditor ? (
          VisualEditorComponent ? (
            <VisualEditorComponent
              html={task.html ?? ""}
              css={task.css ?? ""}
              onHtmlChange={(value) => onTaskChange("html", value)}
              onCssChange={(value) => onTaskChange("css", value)}
              isDark={theme === "dark"}
              canOverrideReadonly={isAdmin}
            />
          ) : (
            <div
              style={{
                display: "flex",
                height: "100%",
                width: "100%",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  theme === "dark" ? "var(--color-bg)" : "var(--color-card)",
              }}
            >
              <LoadingSpinner />
            </div>
          )
        ) : (
          <Editor
            key={`${activeTab}-${currentIndex}`}
            height="100%"
            defaultLanguage={
              activeTab === "js"
                ? "javascript"
                : activeTab === "evaluation"
                  ? "json"
                  : activeTab
            }
            language={
              activeTab === "js"
                ? "javascript"
                : activeTab === "evaluation"
                  ? "json"
                  : activeTab
            }
            value={content}
            onMount={handleEditorMount}
            theme={theme === "dark" ? "vs-dark" : "vs-light"}
            options={{
              minimap: { enabled: false },
              glyphMargin: true,
              fontSize: 14,
              padding: { top: 16, bottom: 16 },
              scrollBeyondLastLine: false,
              readOnly: isEditorReadonly,
              domReadOnly: isEditorReadonly,
            }}
          />
        )}
        <div
          className={`editor-autosave-status is-${autosaveStatus}`}
          role="status"
          aria-live="polite"
        >
          <AutosaveIcon
            size={14}
            aria-hidden="true"
            className={
              autosaveStatus === "saving" ? "autosave-spin-icon" : undefined
            }
          />
          <span>{autosaveMeta.label}</span>
        </div>
      </div>
    </div>
  );
}
