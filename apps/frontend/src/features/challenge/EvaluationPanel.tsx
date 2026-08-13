import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  LoaderCircle,
  X,
} from "lucide-react";
import type { AnalysisIssue, EvaluationResult } from "@wda/css-analysis";
import type { CssEvaluationConfig } from "@/lib/helpers/getTasks";

interface EvaluationPanelProps {
  config?: CssEvaluationConfig;
  result: EvaluationResult | null;
  liveIssues: AnalysisIssue[];
  isEvaluating: boolean;
  isStale?: boolean;
  onIssueClick?: (issue: AnalysisIssue) => void;
}

export default function EvaluationPanel({
  config,
  result,
  liveIssues,
  isEvaluating,
  isStale = false,
  onIssueClick,
}: EvaluationPanelProps) {
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;
    let timer: number | undefined;
    const schedule = () => {
      setHint(null);
      window.clearTimeout(timer);
      const seconds = config.hintTimeoutSeconds ?? 60;
      if (seconds <= 0) return;
      timer = window.setTimeout(() => {
        const issue = (result?.results ?? liveIssues).find(
          (candidate) => candidate.level === "error",
        );
        const failedCheck = config.checks.find((check) =>
          result?.teacherIssues.some(
            (candidate) => candidate.checkId === check.id,
          ),
        );
        setHint(
          failedCheck?.studentHint ||
            issue?.message ||
            "Review the task requirements, then evaluate your current solution.",
        );
      }, seconds * 1000);
    };
    schedule();
    window.addEventListener("keydown", schedule);
    window.addEventListener("pointerdown", schedule);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", schedule);
      window.removeEventListener("pointerdown", schedule);
    };
  }, [config, liveIssues, result]);

  if (!config) return null;

  const visibleIssues = result?.results ?? liveIssues;
  const failedCheckIds = new Set(
    (result?.teacherIssues ?? []).map((issue) => issue.checkId),
  );

  return (
    <section className="challenge-evaluation" aria-live="polite">
      <header className="challenge-evaluation-header">
        <div>
          <strong>Task evaluation</strong>
          <span>
            {isEvaluating
              ? "Comparing your solution…"
              : result
                ? result.passed
                  ? "Requirements passed"
                  : "Keep working on the highlighted issues"
                : "Live CSS feedback"}
          </span>
          {result && isStale && (
            <span className="challenge-stale-result">
              Code changed since this evaluation
            </span>
          )}
        </div>
        {isEvaluating ? (
          <LoaderCircle className="challenge-spin" size={22} />
        ) : result ? (
          <div
            className={`challenge-score ${result.passed ? "is-pass" : "is-fail"}`}
          >
            {result.score}%
          </div>
        ) : null}
      </header>

      {result && (
        <div className="challenge-score-details">
          <span>
            <strong>{result.scoreDetails.visualMatchPercentage}%</strong>
            Visual match
          </span>
          <span>
            <strong>{result.scoreDetails.checksScore} pts</strong>
            Requirements
          </span>
          <span>
            <strong>-{result.scoreDetails.penaltyPoints} pts</strong>
            Penalties
          </span>
        </div>
      )}

      {config.checks.some((check) => check.studentHint) && (
        <div className="challenge-evaluation-section">
          <div className="challenge-evaluation-section-heading">
            <strong>Requirements</strong>
            <span>
              {config.checks.filter((check) => check.studentHint).length}
            </span>
          </div>
          <ul className="challenge-checklist">
            {config.checks
              .filter((check) => check.studentHint)
              .map((check) => {
                const failed = result ? failedCheckIds.has(check.id) : false;
                const complete = result ? !failed : false;
                return (
                  <li
                    key={check.id}
                    className={failed ? "is-fail" : complete ? "is-pass" : ""}
                  >
                    {failed ? (
                      <AlertCircle size={16} />
                    ) : complete ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <span className="challenge-pending-dot" />
                    )}
                    <span>{check.studentHint}</span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {visibleIssues.length > 0 && (
        <div className="challenge-evaluation-section">
          <div className="challenge-evaluation-section-heading">
            <strong>CSS feedback</strong>
            <span>{visibleIssues.length}</span>
          </div>
          <ul className="challenge-issues">
            {visibleIssues.slice(0, 12).map((issue, index) => (
              <li
                key={`${issue.category}-${issue.lineNumber}-${issue.messageCode}-${index}`}
              >
                <button type="button" onClick={() => onIssueClick?.(issue)}>
                  {issue.level === "recommendation" ? (
                    <Lightbulb size={15} />
                  ) : (
                    <AlertCircle size={15} />
                  )}
                  <span>{issue.message || issue.messageCode}</span>
                  <small>CSS line {issue.lineNumber}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && visibleIssues.length === 0 && (
        <div className="challenge-evaluation-empty">
          <CheckCircle2 size={20} />
          <span>No CSS issues found in the latest evaluation.</span>
        </div>
      )}
      {hint && (
        <div className="challenge-hint">
          <Lightbulb size={16} />
          <span>{hint}</span>
          <button
            type="button"
            aria-label="Dismiss hint"
            onClick={() => setHint(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </section>
  );
}
