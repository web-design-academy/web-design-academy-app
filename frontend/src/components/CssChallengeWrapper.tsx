import { useState, useMemo, useCallback } from "react";
import {
  ChallengeProvider,
  ChallengeLayout,
  TaskPanel,
  OutputPanel,
  EditorPanel,
  TeacherTaskCreator,
} from "css-analyzer";
import "css-analyzer/style.css";
import type { TaskCode } from "@/lib/helpers/getTasks";

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

interface ChallengeCompleteResult {
  finalScore: number;
  code: string;
}

interface Props {
  taskData: Partial<TaskCode>;
  isAdmin: boolean;
  onScoreSubmit: (score: number, code: string) => void;
  onConfigSave?: (configString: string) => void;
}

export default function CssChallengeWrapper({
  taskData,
  isAdmin,
  onScoreSubmit,
  onConfigSave,
}: Props) {
  const [mode, setMode] = useState<"student" | "teacher">(
    isAdmin &&
      (!taskData.challengeConfig ||
        taskData.challengeConfig.trim() === "" ||
        taskData.challengeConfig === "{}")
      ? "teacher"
      : "student",
  );

  const analyzerTask = useMemo(() => {
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
        console.error("Chyba v parsovaní challenge.json", e);
      }
    }

    const activeUserCss =
      taskData.editableCss && taskData.editableCss.trim() !== ""
        ? taskData.editableCss
        : config.initialCss || "";

    const stableId =
      config.id ||
      `task-fallback-${taskData.challengeConfig?.length || Date.now()}`;

    return {
      id: stableId,
      title: config.title || "CSS Úloha",
      instructions: config.instructions || "",
      initialHtml: config.initialHtml || "",
      initialCss: activeUserCss,
      solutionCss: config.solutionCss || "",
      targetSelectors: config.targetSelectors || [],
      checks: config.checks || [],
      lockedLines: config.lockedLines || [],
      hintTimeout: config.hintTimeout || 45,
    };
  }, [taskData]);

  const handleComplete = useCallback(
    (result: ChallengeCompleteResult) => {
      onScoreSubmit(result.finalScore, result.code);
    },
    [onScoreSubmit],
  );

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        textAlign: "left",
      }}
    >
      {isAdmin && (
        <div
          style={{
            padding: "10px 20px",
            background: "#1e293b",
            color: "white",
            display: "flex",
            gap: "15px",
            alignItems: "center",
            borderBottom: "1px solid #334155",
          }}
        >
          <span style={{ fontWeight: "bold", color: "#94a3b8" }}>
            Režim učiteľa
          </span>
          <button
            onClick={() => setMode("student")}
            style={{
              padding: "6px 12px",
              background: mode === "student" ? "#10b981" : "transparent",
              border: mode === "student" ? "none" : "1px solid #64748b",
              borderRadius: "6px",
              color: "white",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Testovat
          </button>
          <button
            onClick={() => setMode("teacher")}
            style={{
              padding: "6px 12px",
              background: mode === "teacher" ? "#00137e" : "transparent",
              border: mode === "teacher" ? "none" : "1px solid #64748b",
              borderRadius: "6px",
              color: "white",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Tvorba úkolu
          </button>
        </div>
      )}

      <div style={{ flexGrow: 1, overflow: "hidden" }}>
        {mode === "teacher" ? (
          <div
            style={{ height: "100%", overflowY: "auto", background: "#f8fafc" }}
          >
            <TeacherTaskCreator
              locale="en"
              initialTask={analyzerTask}
              onSave={(config: unknown) => {
                if (!onConfigSave) return;
                if (typeof config === "string") {
                  onConfigSave(config);
                  return;
                }
                onConfigSave(JSON.stringify(config));
              }}
            />
          </div>
        ) : (
          <ChallengeProvider
            task={analyzerTask}
            locale="en"
            onComplete={handleComplete}
          >
            <ChallengeLayout initialWidths={[25, 45, 30]}>
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  background: "var(--color-bg)",
                }}
              >
                <div style={{ flexGrow: 1, overflowY: "auto" }}>
                  <TaskPanel
                    showChecks={true}
                    customPadding="25px"
                    bgColor="transparent"
                  />
                </div>
              </div>
              <OutputPanel
                allowInspect={true}
                showControls={true}
                defaultMode="student"
              />
              <EditorPanel theme="light" showMinimap={false} readOnly={false} />
            </ChallengeLayout>
          </ChallengeProvider>
        )}
      </div>
    </div>
  );
}
