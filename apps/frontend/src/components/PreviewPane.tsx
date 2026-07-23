import { Resizable, type ResizeCallback } from "re-resizable";
import { useEffect, useRef, useState, type ComponentType } from "react";

import { useUiPreferences } from "@/lib/ctx/useUiPreferences";

import "@/styles/preview.css";
import "css-analyzer/style.css";

interface VisualPreviewProps {
  html: string;
  css?: string;
  locale?: "sk" | "en";
  solutionCss?: string;
  solutionHtml?: string;
  initialCss?: string;
  targetSelectors?: string[];
  checks?: unknown[];
  showControls?: boolean;
  hideProgress?: boolean;
}

interface PreviewPaneProps {
  html: string;
  visualHtml?: string;
  visualCss?: string;
  visualPreviewSupported?: boolean;
  solutionCss?: string;
  solutionHtml?: string;
  initialCss?: string;
  targetSelectors?: string[];
  checks?: unknown[];
}

export default function PreviewPane({
  html,
  visualHtml,
  visualCss,
  visualPreviewSupported = true,
  solutionCss,
  solutionHtml,
  initialCss,
  targetSelectors,
  checks,
}: PreviewPaneProps) {
  const [mode, setMode] = useState<"default" | "mobile">("default");
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 1920 / 2.5,
    height: 1080 / 2.5,
  });
  const [showSize, setShowSize] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const { visualPreviewEnabled } = useUiPreferences();
  const [VisualPreviewComponent, setVisualPreviewComponent] =
    useState<ComponentType<VisualPreviewProps> | null>(null);
  const canUseVisualPreview =
    visualPreviewEnabled && visualPreviewSupported && Boolean(visualHtml);

  useEffect(() => {
    if (canUseVisualPreview) {
      import("css-analyzer")
        .then((module) => {
          setVisualPreviewComponent(() => module.default);
        })
        .catch((err) => {
          console.error("Failed to load css analyzer:", err);
        });
    }
  }, [canUseVisualPreview]);

  const showOverlay = () => {
    setShowSize(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setShowSize(false), 300);
  };

  const onSelect: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const value = e.target.value as "default" | "mobile";
    setMode(value);

    const newSize =
      value === "mobile"
        ? { width: 360 / 1.5, height: 705 / 1.5 }
        : { width: 1920 / 2.5, height: 1080 / 2.5 };

    setSize(newSize);
    showOverlay();
  };

  const handleResize: ResizeCallback = (_e, _direction, ref) => {
    setSize({ width: ref.offsetWidth, height: ref.offsetHeight });
    showOverlay();
  };

  const handleWidthChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const w = Number(e.target.value);
    setSize((prev) => ({ ...prev, width: w }));
    showOverlay();
  };

  const handleHeightChange: React.ChangeEventHandler<HTMLInputElement> = (
    e,
  ) => {
    const h = Number(e.target.value);
    setSize((prev) => ({ ...prev, height: h }));
    showOverlay();
  };

  if (canUseVisualPreview && VisualPreviewComponent) {
    return (
      <div className="preview-inner preview-inner-visual">
        <VisualPreviewComponent
          html={visualHtml || ""}
          css={visualCss || ""}
          solutionCss={solutionCss}
          solutionHtml={solutionHtml}
          initialCss={initialCss}
          targetSelectors={targetSelectors}
          checks={checks}
          locale="en"
        />
      </div>
    );
  }

  return (
    <div className="preview-inner">
      <div className="preview-selector">
        <select
          aria-label="Mode"
          className="form-select-control"
          value={mode}
          onChange={onSelect}
        >
          <option value="default">Default view</option>
          <option value="mobile">Mobile view</option>
        </select>

        <input
          aria-label="Width"
          type="number"
          value={Math.round(size.width)}
          onChange={handleWidthChange}
          style={{ width: "5rem" }}
        />

        <span>x</span>

        <input
          aria-label="Height"
          type="number"
          value={Math.round(size.height)}
          onChange={handleHeightChange}
          style={{ width: "5rem" }}
        />
      </div>

      <div className="preview-container">
        <Resizable
          size={size}
          onResize={handleResize}
          onResizeStop={handleResize}
          minHeight={50}
          minWidth={50}
          className="preview-resizable"
        >
          {showSize && (
            <div className="preview-size-overlay">
              {size.width}px × {size.height}px
            </div>
          )}
          <iframe
            title="HTML Preview"
            sandbox="allow-scripts allow-popups"
            referrerPolicy="no-referrer"
            srcDoc={html}
            className="preview-iframe"
          />
        </Resizable>
      </div>
    </div>
  );
}
