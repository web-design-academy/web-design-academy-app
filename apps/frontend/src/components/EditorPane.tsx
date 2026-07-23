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
import * as monaco from "monaco-editor";
import { useTheme } from "@/lib/ctx/useTheme";
import { useUiPreferences } from "@/lib/ctx/useUiPreferences";

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
  readonlyHtml?: string;
  readonlyCss?: string;
  readonlyJs?: string;
  onSubmit: () => Promise<boolean>;
  isSubmitted?: boolean;
  isSubmitDisabled?: boolean;
  submitDisabledTitle?: string;
  autosaveStatus?: "saved" | "saving" | "pending" | "error";
  autosaveLabelPrefix?: string;
}

type Tab = "html" | "css" | "js";
type AdminAssetField =
  | "editableHtml"
  | "editableCss"
  | "editableJs"
  | "readonlyHtml"
  | "readonlyCss"
  | "readonlyJs"
  | "hiddenHtml"
  | "hiddenCss"
  | "hiddenJs"
  | "solutionHtml"
  | "solutionCss"
  | "solutionJs";

const ADMIN_ASSET_TABS: {
  field: AdminAssetField;
  label: string;
  language: Tab;
}[] = [
  { field: "editableHtml", label: "editable.html", language: "html" },
  { field: "editableCss", label: "editable.css", language: "css" },
  { field: "editableJs", label: "editable.js", language: "js" },
  { field: "readonlyHtml", label: "readonly.html", language: "html" },
  { field: "readonlyCss", label: "readonly.css", language: "css" },
  { field: "readonlyJs", label: "readonly.js", language: "js" },
  { field: "hiddenHtml", label: "hidden.html", language: "html" },
  { field: "hiddenCss", label: "hidden.css", language: "css" },
  { field: "hiddenJs", label: "hidden.js", language: "js" },
  { field: "solutionHtml", label: "solution.html", language: "html" },
  { field: "solutionCss", label: "solution.css", language: "css" },
  { field: "solutionJs", label: "solution.js", language: "js" },
];

const getFirstPreferredTab = (task: Partial<TaskCode>): Tab => {
  if (task.editableHtml !== undefined) return "html";
  if (task.editableCss !== undefined) return "css";
  if (task.editableJs !== undefined) return "js";

  if (task.readonlyHtml !== undefined) return "html";
  if (task.readonlyCss !== undefined) return "css";
  if (task.readonlyJs !== undefined) return "js";

  return "html";
};

export default function EditorPane({
  task,
  currentIndex,
  onTaskChange,
  readonlyHtml,
  readonlyCss,
  readonlyJs,
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
  const [activeAdminField, setActiveAdminField] = useState<AdminAssetField>(
    () =>
      ADMIN_ASSET_TABS.find((tab) => task[tab.field] !== undefined)?.field ??
      "editableHtml",
  );
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const lastValidValueRef = useRef("");
  const lastAdminTaskIndexRef = useRef(currentIndex);
  const [VisualEditorComponent, setVisualEditorComponent] =
    useState<ComponentType<VisualEditorProps> | null>(null);
  const { theme } = useTheme();
  const { visualEditorEnabled, setVisualEditorAvailable } = useUiPreferences();

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const showSubmitButton = user && user.role !== "admin";

  const hasEditableHtmlFile = task.editableHtml !== undefined;
  const hasEditableCssFile = task.editableCss !== undefined;
  const hasEditableJsFile = task.editableJs !== undefined;
  const hasHtmlSource =
    readonlyHtml !== undefined || task?.editableHtml !== undefined;
  const hasCssSource =
    readonlyCss !== undefined || task?.editableCss !== undefined;
  const hasJsSource =
    readonlyJs !== undefined || task?.editableJs !== undefined;

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
            : hasJsSource
              ? "js"
              : "html";
  const visualEditorAvailable = hasEditableHtmlFile || hasEditableCssFile;
  const activeAdminTab =
    ADMIN_ASSET_TABS.find((tab) => tab.field === activeAdminField) ??
    ADMIN_ASSET_TABS[0];
  const editorLanguage = isAdmin ? activeAdminTab.language : activeTab;
  const showVisualEditor =
    visualEditorEnabled &&
    visualEditorAvailable &&
    (!isAdmin || activeAdminTab.language !== "js") &&
    activeTab !== "js";
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
    if (!isAdmin) return;
    if (lastAdminTaskIndexRef.current === currentIndex) return;

    const firstExistingTab =
      ADMIN_ASSET_TABS.find((tab) => task[tab.field] !== undefined) ??
      ADMIN_ASSET_TABS[0];
    lastAdminTaskIndexRef.current = currentIndex;
    setActiveAdminField(firstExistingTab.field);
  }, [currentIndex, isAdmin, task]);

  useEffect(() => {
    if (activeTab === "html" && hasHtmlSource) return;
    if (activeTab === "css" && hasCssSource) return;
    if (activeTab === "js" && hasJsSource) return;
    setActiveTab(preferredTab);
  }, [activeTab, hasHtmlSource, hasCssSource, hasJsSource, preferredTab]);

  const content = useMemo(() => {
    if (isAdmin) {
      return task[activeAdminField] ?? "";
    }

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
  }, [
    activeAdminField,
    activeTab,
    isAdmin,
    readonlyHtml,
    readonlyCss,
    readonlyJs,
    task,
  ]);

  const readonlyLinesCount = useMemo(() => {
    if (isAdmin) return 0;

    const r =
      activeTab === "html"
        ? readonlyHtml
        : activeTab === "css"
          ? readonlyCss
          : readonlyJs;
    if (!r) return 0;
    return r.split("\n").length;
  }, [activeTab, isAdmin, readonlyHtml, readonlyCss, readonlyJs]);

  const editableSource =
    activeTab === "html"
      ? task?.editableHtml
      : activeTab === "css"
        ? task?.editableCss
        : task?.editableJs;

  const isTaskDeleted = Boolean(task.deleted);
  const isFileFullyReadonly =
    isTaskDeleted || (!isAdmin && editableSource === undefined);

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
      editor.setValue(content);
    }

    updateDecorations(editor, monacoInstance, readonlyLinesCount);
  }, [content, readonlyLinesCount, showVisualEditor]);

  const mergeReadonlyWithEditable = (
    readonlyPart?: string,
    editablePart?: string,
  ) => `${readonlyPart || ""}${editablePart || ""}`;

  const splitReadonlyFromEditable = (
    nextValue: string,
    readonlyPart?: string,
    previousEditablePart?: string,
  ) => {
    const normalizedNext = nextValue.replace(/\r\n/g, "\n");
    const normalizedReadonly = (readonlyPart || "").replace(/\r\n/g, "\n");

    if (!normalizedReadonly) {
      return normalizedNext;
    }

    if (normalizedNext.startsWith(normalizedReadonly)) {
      return normalizedNext.slice(normalizedReadonly.length);
    }

    return previousEditablePart || "";
  };

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

    if (isAdmin && !isTaskDeleted) {
      onTaskChange(activeAdminField, normalizedVal);
      lastValidValueRef.current = normalizedVal;
      return;
    }

    const r =
      activeTab === "html"
        ? readonlyHtml
        : activeTab === "css"
          ? readonlyCss
          : readonlyJs;
    const normalizedReadonly = (r || "").replace(/\r\n/g, "\n");

    if (isFileFullyReadonly) {
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

    if (!normalizedVal.startsWith(normalizedReadonly)) {
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

  return (
    <div className={`editor-pane ${isTaskDeleted ? "is-task-deleted" : ""}`}>
      <div className="editor-tabs editor-tabs-row">
        <div className="editor-tab-list">
          {isAdmin ? (
            ADMIN_ASSET_TABS.map((tab) => (
              <button
                key={tab.field}
                className={`tab ${activeAdminField === tab.field ? "active" : ""}`}
                onClick={() => setActiveAdminField(tab.field)}
              >
                {tab.label}
              </button>
            ))
          ) : (
            <>
              <button
                className={`tab ${activeTab === "html" ? "active" : ""}`}
                onClick={() => setActiveTab("html")}
                disabled={isHtmlTabDisabled}
                style={
                  isHtmlTabDisabled
                    ? { opacity: 0.3, cursor: "not-allowed" }
                    : {}
                }
              >
                index.html
              </button>
              <button
                className={`tab ${activeTab === "css" ? "active" : ""}`}
                onClick={() => setActiveTab("css")}
                disabled={isCssTabDisabled}
                style={
                  isCssTabDisabled
                    ? { opacity: 0.3, cursor: "not-allowed" }
                    : {}
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
            </>
          )}
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
              content={mergeReadonlyWithEditable(
                readonlyHtml,
                task.editableHtml,
              )}
              setContent={(value) => {
                const currentValue = mergeReadonlyWithEditable(
                  readonlyHtml,
                  task.editableHtml,
                );
                const nextValue =
                  typeof value === "function" ? value(currentValue) : value;
                onTaskChange(
                  "editableHtml",
                  splitReadonlyFromEditable(
                    nextValue,
                    readonlyHtml,
                    task.editableHtml,
                  ),
                );
              }}
              cssContent={mergeReadonlyWithEditable(
                readonlyCss,
                task.editableCss,
              )}
              setCssContent={(value) => {
                const currentValue = mergeReadonlyWithEditable(
                  readonlyCss,
                  task.editableCss,
                );
                const nextValue =
                  typeof value === "function" ? value(currentValue) : value;
                onTaskChange(
                  "editableCss",
                  splitReadonlyFromEditable(
                    nextValue,
                    readonlyCss,
                    task.editableCss,
                  ),
                );
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
            key={`${isAdmin ? activeAdminField : activeTab}-${currentIndex}`}
            height="100%"
            defaultLanguage={
              editorLanguage === "js" ? "javascript" : editorLanguage
            }
            language={editorLanguage === "js" ? "javascript" : editorLanguage}
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
