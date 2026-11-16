import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisIssue, EvaluationResult } from "@wda/css-analysis";
import type { TaskCode } from "@/lib/helpers/getTasks";

type AnalyzerModule = typeof import("@wda/css-analysis");

let analyzerModulePromise: Promise<AnalyzerModule> | null = null;

function loadAnalyzer() {
  analyzerModulePromise ??= import("@wda/css-analysis");
  return analyzerModulePromise;
}

function formatIssue(
  issue: AnalysisIssue,
  translate: AnalyzerModule["translateAnalyzerMessage"],
): AnalysisIssue {
  if (issue.message) return issue;

  let message: string;
  if (issue.messageCode === "ignoredProp") {
    const reason = translate(
      "en",
      "rules",
      String(issue.msgParams?.reasonCode ?? ""),
    );
    message = translate("en", "linter", "ignoredProp", {
      prop: String(issue.msgParams?.prop ?? ""),
      reason,
    });
  } else if (issue.messageCode === "specialRule") {
    message = translate(
      "en",
      "rules",
      String(issue.msgParams?.reasonCode ?? ""),
    );
  } else {
    message = translate(
      "en",
      issue.category,
      issue.messageCode,
      issue.msgParams,
    );
  }

  return { ...issue, message: message || issue.messageCode };
}

export function useTaskEvaluation(
  task: Partial<TaskCode> | undefined,
  liveEnabled = true,
  taskKey?: string | number,
) {
  const [liveIssues, setLiveIssues] = useState<AnalysisIssue[]>([]);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [evaluatedFingerprint, setEvaluatedFingerprint] = useState<
    string | null
  >(null);
  const [resultTaskKey, setResultTaskKey] = useState(taskKey);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const evaluationRunRef = useRef(0);
  const manualEvaluationRunRef = useRef(0);
  const inputFingerprint = JSON.stringify([
    task?.html ?? "",
    task?.css ?? "",
    task?.js ?? "",
    task?.solutionHtml ?? "",
    task?.solutionCss ?? "",
    task?.evaluation ?? null,
  ]);

  if (resultTaskKey !== taskKey) {
    setResultTaskKey(taskKey);
    setResult(null);
    setEvaluatedFingerprint(null);
    setIsEvaluating(false);
  }
  const isResultStale =
    result !== null && evaluatedFingerprint !== inputFingerprint;
  const canAnalyze = liveEnabled && task?.evaluation?.engine === "css";

  useEffect(() => {
    return () => {
      manualEvaluationRunRef.current += 1;
    };
  }, [taskKey]);

  useEffect(() => {
    const runId = ++evaluationRunRef.current;

    if (!liveEnabled || !task?.evaluation || task.evaluation.engine !== "css") {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadAnalyzer().then((analyzer) => {
        if (runId !== evaluationRunRef.current) return;
        const doc = new DOMParser().parseFromString(
          task.html ?? "",
          "text/html",
        );
        const issues = analyzer
          .lintCssAst(
            task.css ?? "",
            doc,
            task.evaluation?.targetSelectors ?? [],
          )
          .map((issue) =>
            formatIssue(issue, analyzer.translateAnalyzerMessage),
          );
        setLiveIssues(issues);
      });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      evaluationRunRef.current += 1;
    };
  }, [liveEnabled, taskKey, task?.css, task?.evaluation, task?.html]);

  const evaluate = useCallback(async () => {
    if (!task?.evaluation || task.evaluation.engine !== "css") return null;

    const runId = ++manualEvaluationRunRef.current;
    setIsEvaluating(true);
    try {
      const analyzer = await loadAnalyzer();
      const nextResult = await analyzer.evaluateCssTask({
        html: task.html ?? "",
        css: task.css ?? "",
        solutionHtml: task.solutionHtml ?? task.html ?? "",
        solutionCss: task.solutionCss ?? "",
        config: task.evaluation,
      });
      const translatedResult = {
        ...nextResult,
        results: nextResult.results.map((issue) =>
          formatIssue(issue, analyzer.translateAnalyzerMessage),
        ),
        teacherIssues: nextResult.teacherIssues.map((issue) =>
          formatIssue(issue, analyzer.translateAnalyzerMessage),
        ),
      };
      if (runId !== manualEvaluationRunRef.current) return null;
      setEvaluatedFingerprint(inputFingerprint);
      setResult(translatedResult);
      return translatedResult;
    } finally {
      if (runId === manualEvaluationRunRef.current) setIsEvaluating(false);
    }
  }, [inputFingerprint, task]);

  const clearResult = useCallback(() => {
    manualEvaluationRunRef.current += 1;
    setIsEvaluating(false);
    setEvaluatedFingerprint(null);
    setResult(null);
  }, []);

  return {
    liveIssues: canAnalyze ? liveIssues : [],
    result,
    isResultStale,
    isEvaluating,
    evaluate,
    clearResult,
  };
}
