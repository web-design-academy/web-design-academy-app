import { Editor, type OnMount } from "@monaco-editor/react";
import { type TaskCode } from "@/lib/helpers/getTasks";
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
} from "lucide-react";
import SubmitButton from "./SubmitButton";
import LoadingSpinner from "./LoadingSpinner";
import "@/styles/editor.css";
import "visualeditor-html-css/style.css";
import { useTheme } from "@/lib/ctx/useTheme";
import { useUiPreferences } from "@/lib/ctx/useUiPreferences";
import {
  canApplyStudentEdit,
  hasReadonlyBlocks,
  parseReadonlyRanges,
} from "@/lib/helpers/readonlyBlocks";

interface VisualEditorProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
  cssContent: string;
  setCssContent: React.Dispatch<React.SetStateAction<string>>;
  isDark: boolean;
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
}

type Tab = "html" | "css" | "js";
type MountedEditor = Parameters<OnMount>[0];
type MountedMonaco = Parameters<OnMount>[1];

const taskFieldByTab = {
  html: "html",
  css: "css",
  js: "js",
} as const satisfies Record<Tab, keyof TaskCode>;

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
}: EditorPaneProps) {
  const [activeTab, setActiveTab] = useState<Tab>(() =>
    getFirstPreferredTab(task),
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

  const isHtmlTabDisabled = !hasHtmlSource;
  const isCssTabDisabled = !hasCssSource;
  const isJsTabDisabled = !hasJsSource;
  const preferredTab: Tab = hasHtmlSource
    ? "html"
    : hasCssSource
      ? "css"
      : hasJsSource
        ? "js"
        : "html";
  const hasProtectedVisualSource =
    hasReadonlyBlocks(task.html, "html") || hasReadonlyBlocks(task.css, "css");
  const visualEditorAvailable =
    (hasHtmlSource || hasCssSource) &&
    (isAdmin || !hasProtectedVisualSource) &&
    !hasJsSource;
  const showVisualEditor =
    visualEditorEnabled && visualEditorAvailable && activeTab !== "js";
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
      import("visualeditor-html-css")
        .then((module) => {
          setVisualEditorComponent(() => module.VisualEditor);
        })
        .catch((err) => {
          console.error("Failed to load visual editor:", err);
        });
    }
  }, [showVisualEditor]);

  useEffect(() => {
    setActiveTab(preferredTab);
  }, [currentIndex, preferredTab]);

  useEffect(() => {
    if (activeTab === "html" && hasHtmlSource) return;
    if (activeTab === "css" && hasCssSource) return;
    if (activeTab === "js" && hasJsSource) return;
    setActiveTab(preferredTab);
  }, [activeTab, hasHtmlSource, hasCssSource, hasJsSource, preferredTab]);

  const content = useMemo(() => {
    return task[taskFieldByTab[activeTab]] ?? "";
  }, [activeTab, task]);

  const readonlyRanges = useMemo(() => {
    try {
      return parseReadonlyRanges(content, activeTab);
    } catch {
      return [];
    }
  }, [activeTab, content]);

  const hasInvalidReadonlyMarkers = useMemo(() => {
    if (isAdmin) return false;

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
      } = editorStateRef.current;

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
        </div>
        <div className="editor-tab-controls">
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
              content={task.html ?? ""}
              setContent={(value) => {
                const currentValue = task.html ?? "";
                const nextValue =
                  typeof value === "function" ? value(currentValue) : value;
                onTaskChange("html", nextValue);
              }}
              cssContent={task.css ?? ""}
              setCssContent={(value) => {
                const currentValue = task.css ?? "";
                const nextValue =
                  typeof value === "function" ? value(currentValue) : value;
                onTaskChange("css", nextValue);
              }}
              isDark={theme === "dark"}
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
            defaultLanguage={activeTab === "js" ? "javascript" : activeTab}
            language={activeTab === "js" ? "javascript" : activeTab}
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
