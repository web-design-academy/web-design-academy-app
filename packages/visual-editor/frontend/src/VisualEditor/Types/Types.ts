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
}

export interface VisualEditorProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
  cssContent: string;
  setCssContent: React.Dispatch<React.SetStateAction<string>>;
  isDark: boolean;
}