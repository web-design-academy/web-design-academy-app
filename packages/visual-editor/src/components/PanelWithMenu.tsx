import { X } from "lucide-react";

/**
 * ------------------------------------------------------------
 * File: PaneleWithMenu.tsx
 * Description: Background for Elements, NodeAttributes and NodeStyleEditor
 * Author: Karolína Virágová, xvirag00
 * Created: 2026-03-10
 * ------------------------------------------------------------
 */
type PanelType = "add" | "attr" | "style" | "style-from-attr" | null;

export default function PanelWithMenu({
  activePanel,
  setActivePanel,
  children,
  title,
  icon,
}: {
  activePanel: PanelType;
  setActivePanel: React.Dispatch<React.SetStateAction<PanelType>>;
  children: React.ReactNode;
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="ve-panel wda-card" onClick={(e) => e.stopPropagation()}>
      <div className="ve-panel-heading">
        <div className="ve-panel-title">
          {icon}
          <strong>{title}</strong>
        </div>
        <button
          type="button"
          className="wda-icon-button"
          aria-label="Close panel"
          onClick={() => setActivePanel(null)}
        >
          <X size={16} />
        </button>
      </div>
      <div className="ve-panel-tabs wda-segmented">
        <button
          onClick={() => setActivePanel("add")}
          className={`ve-panel-tab wda-segment ${activePanel === "add" ? "is-active" : ""}`}
        >
          Elements
        </button>
        <button
          onClick={() => setActivePanel("attr")}
          className={`ve-panel-tab wda-segment ${activePanel === "attr" ? "is-active" : ""}`}
        >
          Attributes
        </button>
        <button
          onClick={() => setActivePanel("style")}
          className={`ve-panel-tab wda-segment ${activePanel === "style" ? "is-active" : ""}`}
        >
          Style
        </button>
      </div>

      <div className="ve-panel-body">{children}</div>
    </div>
  );
}
