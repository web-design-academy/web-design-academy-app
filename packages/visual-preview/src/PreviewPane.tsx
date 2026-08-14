import { OutputPanel } from "./components/OutputPanel";
import type { ReactNode } from "react";

export interface PreviewPaneProps {
  html: string;
  css?: string;
  locale?: "sk" | "en";
  solutionCss?: string;
  solutionHtml?: string;
  initialCss?: string;
  showControls?: boolean;
  evaluationContent?: ReactNode;
  evaluationViewRequest?: number;
  onSelectSelector?: (selector: string) => void;
}

export default function PreviewPane({
  html,
  css = "",
  locale = "en",
  solutionCss = "",
  solutionHtml = "",
  initialCss = "",
  showControls = true,
  evaluationContent,
  evaluationViewRequest,
  onSelectSelector,
}: PreviewPaneProps) {
  return (
    <OutputPanel
      html={html}
      css={css}
      solutionCss={solutionCss || initialCss}
      solutionHtml={solutionHtml || html}
      locale={locale}
      showControls={showControls}
      evaluationContent={evaluationContent}
      evaluationViewRequest={evaluationViewRequest}
      onSelectSelector={onSelectSelector}
    />
  );
}
