/**
 * ------------------------------------------------------------
 * File: Types.ts
 * Description:
 * Author: Karolína Virágová, xvirag00
 * Created: 2026-03-10
 * ------------------------------------------------------------
 */

export interface Attribute {
  name: string;
  value: string;
}

export interface Item {
  id: string;
  name: string;
  attributes: Attribute[];
  children: Item[];
  kind?: "element" | "text" | "comment" | "doctype";
  text?: string;
  originalText?: string;
  originalName?: string;
  originalAttributes?: Attribute[];
  raw?: string;
  rawOpen?: string;
  rawClose?: string;
  leading?: string;
  innerTrailing?: string;
  trailing?: string;
  readonly?: boolean;
  containsReadonly?: boolean;
}

export interface VisualEditorProps {
  html: string;
  css: string;
  onHtmlChange: (html: string) => void;
  onCssChange: (css: string) => void;
  isDark: boolean;
  canOverrideReadonly?: boolean;
}
