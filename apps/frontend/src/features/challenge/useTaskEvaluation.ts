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

  let message = "";
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
  const [isResultStale, setIsResultStale] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const evaluationRunRef = useRef(0);
  const resultRef = useRef<EvaluationResult | null>(null);
  const evaluatedFingerprintRef = useRef<string | null>(null);
  const inputFingerprint = JSON.stringify([
    task?.html ?? "",
    task?.css ?? "",
    task?.js ?? "",
    task?.solutionHtml ?? "",
    task?.solutionCss ?? "",
    task?.evaluation ?? null,
  ]);

  useEffect(() => {
    evaluationRunRef.current += 1;
    resultRef.current = null;
    evaluatedFingerprintRef.current = null;
    setResult(null);
    setIsResultStale(false);
  }, [taskKey]);

  useEffect(() => {
    if (
      resultRef.current &&
      evaluatedFingerprintRef.current !== inputFingerprint
    ) {
      setIsResultStale(true);
    }
  }, [inputFingerprint]);

  useEffect(() => {
    const runId = ++evaluationRunRef.current;

    if (!liveEnabled || !task?.evaluation || task.evaluation.engine !== "css") {
      setLiveIssues([]);
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

    return () => window.clearTimeout(timer);
  }, [liveEnabled, task?.css, task?.evaluation, task?.html]);

  const evaluate = useCallback(async () => {
    if (!task?.evaluation || task.evaluation.engine !== "css") return null;

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
      resultRef.current = translatedResult;
      evaluatedFingerprintRef.current = inputFingerprint;
      setResult(translatedResult);
      setIsResultStale(false);
      return translatedResult;
    } finally {
      setIsEvaluating(false);
    }
  }, [inputFingerprint, task]);

  const clearResult = useCallback(() => {
    resultRef.current = null;
    evaluatedFingerprintRef.current = null;
    setResult(null);
    setIsResultStale(false);
  }, []);

  return {
    liveIssues,
    result,
    isResultStale,
    isEvaluating,
    evaluate,
    clearResult,
  };
}
