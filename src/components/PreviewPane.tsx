import { Resizable, type ResizeCallback } from "re-resizable";
import { useState, useRef } from "react";
import "../styles/preview.css";

interface PreviewPaneProps {
  html: string;
}

export default function PreviewPane({ html }: PreviewPaneProps) {
  const [mode, setMode] = useState<"default" | "mobile">("default");
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 1920 / 2.5,
    height: 1080 / 2.5,
  });
  const [showSize, setShowSize] = useState(false);
  const timeoutRef = useRef<number | null>(null);

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

  const htmlContent = `
  <html>
    <head>
      <style>
        body {
          margin: 0;
          padding: 0;
        }
      </style>
    </head>
    <body>
      ${html}
    </body>
  </html>
`;

  return (
    <div className="preview-inner">
      <div className="preview-selector">
        <select aria-label="Mode" value={mode} onChange={onSelect}>
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
            sandbox="allow-scripts allow-same-origin"
            srcDoc={htmlContent}
            className="preview-iframe"
          />
        </Resizable>
      </div>
    </div>
  );
}
