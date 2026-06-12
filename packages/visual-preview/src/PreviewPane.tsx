import { useMemo } from "react";

import { ChallengeProvider } from "./context/ChallengeContext";
import { OutputPanel } from "./components/OutputPanel";

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

export default function PreviewPane({
  html,
  css = "",
  locale = "en",
  solutionCss = "",
  solutionHtml = "",
  initialCss = "",
  targetSelectors = [],
  checks = [],
  showControls = true,
  hideProgress = true,
}: PreviewPaneProps) {
  const task = useMemo(
    () => ({
      id: "workspace-preview",
      title: "Preview",
      instructions: "",
      initialHtml: html,
      initialCss: initialCss,
      solutionCss: solutionCss,
      solutionHtml: solutionHtml,
      currentCode: css,
      targetSelectors: targetSelectors,
      checks: checks,
    }),
    [css, html, solutionCss, solutionHtml, initialCss, targetSelectors, checks],
  );

  return (
    <ChallengeProvider task={task} locale={locale}>
      <OutputPanel showControls={showControls} hideProgress={hideProgress} />
    </ChallengeProvider>
  );
}
