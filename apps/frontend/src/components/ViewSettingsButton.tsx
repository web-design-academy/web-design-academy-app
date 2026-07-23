import { Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useUiPreferences } from "@/lib/ctx/useUiPreferences";

export default function ViewSettingsButton() {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const {
    visualEditorEnabled,
    visualPreviewEnabled,
    visualEditorAvailable,
    setVisualEditorEnabled,
    setVisualPreviewEnabled,
  } = useUiPreferences();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="settings-menu" ref={rootRef}>
      <button
        type="button"
        className="icon-button"
        aria-label="Open visual tools settings"
        title="Visual tools settings"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Settings2 className="theme-icon" size={20} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className="settings-popover"
          role="dialog"
          aria-label="Visual tools settings"
        >
          <label className="settings-option">
            <span>Visual editor</span>
            <input
              type="checkbox"
              checked={visualEditorAvailable && visualEditorEnabled}
              disabled={!visualEditorAvailable}
              onChange={(event) => setVisualEditorEnabled(event.target.checked)}
              title={
                visualEditorAvailable
                  ? "Toggle visual editor"
                  : "Visual editor is available only for tasks with editable HTML or CSS"
              }
            />
          </label>

          <label className="settings-option">
            <span>Visual preview</span>
            <input
              type="checkbox"
              checked={visualPreviewEnabled}
              onChange={(event) =>
                setVisualPreviewEnabled(event.target.checked)
              }
            />
          </label>
        </div>
      )}
    </div>
  );
}
