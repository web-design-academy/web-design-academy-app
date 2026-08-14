import * as React from "react";

export interface PreviewPaneProps {
  html: string;
  css?: string;
  locale?: "sk" | "en";
  solutionCss?: string;
  solutionHtml?: string;
  initialCss?: string;
  targetSelectors?: string[];
  checks?: any[];
  showControls?: boolean;
  hideProgress?: boolean;
}

export const PreviewPane: React.ComponentType<PreviewPaneProps>;
export const ChallengeProvider: any;
export const useChallenge: any;
export const ChallengeLayout: any;
export const TaskPanel: any;
export const OutputPanel: any;
export const EditorPanel: any;
export const TeacherTaskCreator: any;
export const analyzeCss: any;
export const lintCssAst: any;
declare const _default: React.ComponentType<PreviewPaneProps>;
export default _default;
