import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Resizable, type ResizeCallback } from "re-resizable";
import * as CssAnalyzer from "css-analyzer";
import {
  ChallengeProvider,
  OutputPanel,
  TaskPanel,
  TeacherTaskCreator,
} from "css-analyzer";
import "css-analyzer/style.css";

import EditorPane from "@/components/EditorPane";
import Modal from "@/components/Modal";
import PreviewPane from "@/components/PreviewPane";
import type { TaskCode } from "@/lib/helpers/getTasks";

interface AnalyzerChallengeContext {
  userCss?: string;
  getCurrentCode?: () => string;
  score?: number;
  task?: ReturnType<typeof buildAnalyzerTask>;
}

const useFallbackChallenge = (): null => null;
const useChallenge =
  (CssAnalyzer as { useChallenge?: () => AnalyzerChallengeContext | null })
    .useChallenge ?? useFallbackChallenge;

interface AnalyzerTaskConfig {
  id?: string;
  title?: string;
  instructions?: string;
  initialHtml?: string;
  initialCss?: string;
  solutionCss?: string;
  targetSelectors?: string[];
  checks?: unknown[];
  lockedLines?: number[];
  hintTimeout?: number;
}

interface Props {
  taskData: Partial<TaskCode>;
  isAdmin: boolean;
  currentIndex: number;
  totalTasks: number;
  onTaskChange: (field: keyof Partial<TaskCode>, value: string) => void;
  onChangeTask: (index: number) => void;
  readonlyHtml?: string;
  readonlyCss?: string;
  readonlyJs?: string;
  onSubmitCss: (css: string) => Promise<void>;
  completedTasks?: Set<string>;
  currentTaskId?: string;
  onAddTask?: () => void;
  onResetTask?: () => void;
  lessonSlug?: string;
  allowVisualMode?: boolean;
  allowAnalyzerEditor?: boolean;
  previewHtml: string;
  lessonContent: ReactNode;
  editorPercent: number;
  topRowPercent: number;
  onEditorResize: ResizeCallback;
  onTopRowResize: ResizeCallback;
}

interface WorkspaceProps extends Props {
  analyzerTask: ReturnType<typeof buildAnalyzerTask>;
}

function buildAnalyzerTask(taskData: Partial<TaskCode>) {
  let config: AnalyzerTaskConfig = {};

  if (
    taskData.challengeConfig &&
    taskData.challengeConfig !== "{}" &&
    taskData.challengeConfig.trim() !== ""
  ) {
    try {
      const parsed = JSON.parse(taskData.challengeConfig) as unknown;
      if (parsed && typeof parsed === "object") {
        config = parsed as AnalyzerTaskConfig;
      }
    } catch (e) {
      console.error("Failed to parse challenge.json", e);
    }
  }

  const activeUserCss =
    taskData.editableCss && taskData.editableCss.trim() !== ""
      ? taskData.editableCss
      : config.initialCss || "";

  const activeHtml =
    (taskData.readonlyHtml || "") +
    (taskData.editableHtml || config.initialHtml || "");

  const stableId =
    config.id ||
    `task-fallback-${taskData.challengeConfig?.length || Date.now()}`;

  return {
    id: stableId,
    title: config.title || "CSS Challenge",
    instructions: config.instructions || "",
    initialHtml: activeHtml,
    initialCss: config.initialCss || "",
    originalCss: config.initialCss || "",
    currentCode: activeUserCss,
    solutionCss:
      taskData.solutionCss || taskData.hiddenCss || config.solutionCss || "",
    targetSelectors: config.targetSelectors || [],
    checks: config.checks || [],
    lockedLines: config.lockedLines || [],
    hintTimeout: config.hintTimeout || 45,
  };
}

function ChallengeWorkspace({
  taskData,
  isAdmin,
  currentIndex,
  totalTasks,
  onTaskChange,
  onChangeTask,
  readonlyHtml,
  readonlyCss,
  readonlyJs,
  onSubmitCss,
  completedTasks,
  currentTaskId,
  onAddTask,
  onResetTask,
  lessonSlug,
  allowVisualMode = true,
  allowAnalyzerEditor = false,
  previewHtml,
  lessonContent,
  editorPercent,
  topRowPercent,
  onEditorResize,
  onTopRowResize,
  analyzerTask,
}: WorkspaceProps) {
  const [showTeacherPanel, setShowTeacherPanel] = useState(false);
  const [useAdvancedEditor, setUseAdvancedEditor] =
    useState(allowAnalyzerEditor);
  const [showWarningModal, setShowWarningModal] = useState(false);

  const latestScoreRef = useRef(0);
  const challenge = useChallenge();
  const lastSyncTaskId = useRef(analyzerTask.id);
  const previousUserCssRef = useRef(taskData.editableCss);

  useEffect(() => {
    if (!allowAnalyzerEditor && useAdvancedEditor) {
      setUseAdvancedEditor(false);
    }
  }, [allowAnalyzerEditor, useAdvancedEditor]);

  useEffect(() => {
    if (lastSyncTaskId.current !== analyzerTask.id) {
      lastSyncTaskId.current = analyzerTask.id;
      previousUserCssRef.current = taskData.editableCss;
      return;
    }

    if (
      challenge?.userCss !== undefined &&
      challenge.userCss !== previousUserCssRef.current
    ) {
      previousUserCssRef.current = challenge.userCss;
      onTaskChange("editableCss", challenge.userCss);
    }
  }, [analyzerTask.id, challenge?.userCss, onTaskChange, taskData.editableCss]);

  const submitWithCurrentCode = async () => {
    let freshCode = taskData.editableCss || "";

    if (challenge?.getCurrentCode) {
      freshCode = challenge.getCurrentCode();
    }

    onTaskChange("editableCss", freshCode);
    await onSubmitCss(freshCode);
  };

  const handleSubmit = async () => {
    const currentScore = challenge?.score || 0;

    if (currentScore >= 100) {
      await submitWithCurrentCode();
      return;
    }

    latestScoreRef.current = currentScore;
    setShowWarningModal(true);
  };

  return (
    <>
      <div
        className="css-analyzer-scope"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            flexGrow: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Resizable
            className="lesson-top-row"
            size={{ width: "100%", height: `${topRowPercent}%` }}
            enable={{ bottom: true }}
            minHeight={100}
            maxHeight="90%"
            onResize={onTopRowResize}
            onResizeStop={onTopRowResize}
            handleComponent={{
              bottom: <div className="resize-handle-bottom" />,
            }}
            handleStyles={{ bottom: { height: 16 } }}
          >
            <div className="lesson-top-inner">
              <Resizable
                className="lesson-editor"
                size={{ width: `${editorPercent}%`, height: "100%" }}
                enable={{ right: true }}
                minWidth="15%"
                maxWidth="85%"
                onResize={onEditorResize}
                onResizeStop={onEditorResize}
                handleComponent={{
                  right: <div className="resize-handle-right" />,
                }}
                handleStyles={{ right: { width: 16 } }}
              >
                <EditorPane
                  task={taskData}
                  currentIndex={currentIndex}
                  totalTasks={totalTasks}
                  onTaskChange={onTaskChange}
                  onChangeTask={onChangeTask}
                  readonlyHtml={readonlyHtml}
                  readonlyCss={readonlyCss}
                  readonlyJs={readonlyJs}
                  onSubmit={handleSubmit}
                  completedTasks={completedTasks}
                  currentTaskId={currentTaskId}
                  onAddTask={onAddTask}
                  onResetTask={onResetTask}
                  lessonSlug={lessonSlug}
                  isCssChallenge={true}
                  allowVisualMode={allowVisualMode}
                  allowAnalyzerEditor={allowAnalyzerEditor}
                  onConfigureChallenge={() =>
                    setShowTeacherPanel((prev) => !prev)
                  }
                  useAdvancedEditor={useAdvancedEditor}
                  onToggleAdvancedEditor={setUseAdvancedEditor}
                />
              </Resizable>

              <div
                className="lesson-preview"
                style={{
                  width: `${100 - editorPercent}%`,
                  display: "flex",
                  flexDirection: "column",
                  borderLeft: "1px solid var(--color-border)",
                }}
              >
                <div style={{ flexGrow: 1, position: "relative" }}>
                  <div
                    style={{
                      position: useAdvancedEditor ? "relative" : "absolute",
                      top: useAdvancedEditor ? 0 : "-9999px",
                      left: useAdvancedEditor ? 0 : "-9999px",
                      width: "100%",
                      height: "100%",
                      visibility: useAdvancedEditor ? "visible" : "hidden",
                    }}
                  >
                    <OutputPanel
                      allowInspect={true}
                      showControls={true}
                      defaultMode="student"
                    />
                  </div>
                  <div
                    style={{
                      position: !useAdvancedEditor ? "relative" : "absolute",
                      top: !useAdvancedEditor ? 0 : "-9999px",
                      left: !useAdvancedEditor ? 0 : "-9999px",
                      width: "100%",
                      height: "100%",
                      visibility: !useAdvancedEditor ? "visible" : "hidden",
                    }}
                  >
                    <PreviewPane html={previewHtml} />
                  </div>
                </div>
              </div>
            </div>
          </Resizable>

          <div
            className="lesson-content"
            style={{ height: `${100 - topRowPercent}%`, padding: 0 }}
          >
            {showTeacherPanel && isAdmin ? (
              <div
                style={{
                  height: "100%",
                  background: "var(--color-bg)",
                  padding: "20px",
                  overflowY: "auto",
                }}
              >
                <TeacherTaskCreator
                  locale="en"
                  initialTask={challenge?.task}
                  onSave={(jsonOutput: unknown) => {
                    const serialized = JSON.stringify(jsonOutput, null, 2);
                    onTaskChange("challengeConfig", serialized);

                    if (
                      jsonOutput &&
                      typeof jsonOutput === "object" &&
                      "solutionCss" in jsonOutput &&
                      typeof jsonOutput.solutionCss === "string"
                    ) {
                      onTaskChange("hiddenCss", jsonOutput.solutionCss);
                    }

                    setShowTeacherPanel(false);
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  height: "100%",
                  position: "relative",
                  background: "var(--color-bg)",
                }}
              >
                <div
                  style={{
                    position: useAdvancedEditor ? "relative" : "absolute",
                    top: useAdvancedEditor ? 0 : "-9999px",
                    left: useAdvancedEditor ? 0 : "-9999px",
                    width: "100%",
                    height: "100%",
                    overflowY: "auto",
                    visibility: useAdvancedEditor ? "visible" : "hidden",
                  }}
                >
                  <TaskPanel
                    showChecks={true}
                    customPadding="25px"
                    bgColor="transparent"
                  />
                </div>
                <div
                  style={{
                    position: !useAdvancedEditor ? "relative" : "absolute",
                    top: !useAdvancedEditor ? 0 : "-9999px",
                    left: !useAdvancedEditor ? 0 : "-9999px",
                    width: "100%",
                    height: "100%",
                    overflowY: "auto",
                    padding: "25px",
                    visibility: !useAdvancedEditor ? "visible" : "hidden",
                  }}
                >
                  {lessonContent}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        title="Incomplete Score"
        isOpen={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        actions={
          <div
            style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}
          >
            <button
              className="btn-ghost"
              onClick={() => setShowWarningModal(false)}
            >
              Cancel and fix
            </button>
            <button
              className="btn-primary"
              style={{ backgroundColor: "#ef4444" }}
              onClick={async () => {
                setShowWarningModal(false);
                await submitWithCurrentCode();
              }}
            >
              Submit anyway
            </button>
          </div>
        }
      >
        <p>
          Your solution did not reach 100%. The current score is{" "}
          <strong>{latestScoreRef.current}%</strong>.
        </p>
        <p>
          You can still submit, but we recommend evaluating and fixing the
          remaining issues first.
        </p>
      </Modal>
    </>
  );
}

export default function CssChallengeWrapper(props: Props) {
  const analyzerTask = useMemo(
    () => buildAnalyzerTask(props.taskData),
    [props.taskData],
  );

  return (
    <ChallengeProvider
      key={analyzerTask.id}
      task={analyzerTask}
      locale="en"
      onComplete={() => {}}
    >
      <ChallengeWorkspace {...props} analyzerTask={analyzerTask} />
    </ChallengeProvider>
  );
}
