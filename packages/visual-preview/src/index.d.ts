import * as React from "react";

export type EvaluationLevel = "error" | "warning" | "recommendation";
export type EvaluationCheckType =
  | "forbidden-property"
  | "required-property"
  | "exists"
  | "exact-match"
  | "regex-match"
  | "min-count"
  | "max-count"
  | "forbidden-value";

export interface EvaluationCheck {
  id: string;
  type: EvaluationCheckType;
  selector: string;
  property: string;
  value?: string | number;
  media?: string;
  level?: EvaluationLevel;
  message?: string;
  studentHint?: string;
}

export interface CssEvaluationConfig {
  version: 1;
  engine: "css";
  targetSelectors: string[];
  checks: EvaluationCheck[];
  hintTimeoutSeconds?: number;
  pass?: { minimumScore?: number; requireNoErrors?: boolean };
}

export interface AnalysisIssue {
  category: "linter" | "checks" | "analyzer";
  level: EvaluationLevel;
  lineNumber: number;
  messageCode: string;
  msgParams?: Record<string, string | number>;
  message?: string | null;
  checkId?: string;
}

export interface EvaluationResult {
  passed: boolean;
  status: "error" | "success_with_warning" | "success_perfect";
  score: number;
  results: AnalysisIssue[];
  teacherIssues: AnalysisIssue[];
  scoreDetails: {
    visualScore: number;
    visualMatchPercentage: number;
    checksScore: number;
    penaltyPoints: number;
  };
}

export interface EvaluateCssTaskInput {
  html: string;
  css: string;
  solutionHtml?: string;
  solutionCss?: string;
  config: CssEvaluationConfig;
  viewport?: { width?: number; height?: number };
}

export interface PreviewPaneProps {
  html: string;
  css?: string;
  locale?: "sk" | "en";
  solutionCss?: string;
  solutionHtml?: string;
  initialCss?: string;
  showControls?: boolean;
  evaluationContent?: React.ReactNode;
  evaluationViewRequest?: number;
  onSelectSelector?: (selector: string) => void;
}

export function lintCssAst(
  css: string,
  document?: Document | null,
  targetSelectors?: string[],
): AnalysisIssue[];
export function evaluateCssTask(
  input: EvaluateCssTaskInput,
): Promise<EvaluationResult>;
export function generateEvaluationChecks(
  solutionCss: string,
): CssEvaluationConfig;
export function translateAnalyzerMessage(
  locale: "sk" | "en",
  category: string,
  key: string,
  params?: Record<string, string | number>,
): string;

export const PreviewPane: React.ComponentType<PreviewPaneProps>;
