/**
 * ------------------------------------------------------------
 * File: PreviewFrame.tsx
 * Description: 
 *  React component for displaying a live preview of HTML and CSS content
 *  inside an isolated iframe.
 * 
 * Author: Karolína Virágová, xvirag00
 * Created: 2026-03-10
 * ------------------------------------------------------------
 */

interface Props {
  htmlContent: string;
  cssContent: string;
  previewWidth: number | "full";
}

export default function PreviewFrame({ htmlContent, cssContent, previewWidth }: Props) {
  return (
    <iframe
      style={{ width: previewWidth === "full" ? "100%" : previewWidth, height: "100%", background: "white" }}
      sandbox="allow-scripts"
      srcDoc={`<!DOCTYPE html><html><head><style>${cssContent}</style></head>${htmlContent}</html>`}
    />
  );
}