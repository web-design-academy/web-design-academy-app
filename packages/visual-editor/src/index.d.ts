import * as React from "react";

export interface VisualEditorProps {
  html: string;
  css: string;
  onHtmlChange: (html: string) => void;
  onCssChange: (css: string) => void;
  isDark: boolean;
  canOverrideReadonly?: boolean;
}

export const VisualEditor: React.ComponentType<VisualEditorProps>;

export interface VisualEditorItem {
  id: string;
  name: string;
  attributes: { name: string; value: string }[];
  children: VisualEditorItem[];
}

export function parseHtmlToTree(html: string): VisualEditorItem[];
export function exportHtml(items: VisualEditorItem[]): string;
