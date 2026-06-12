/**
 * ------------------------------------------------------------
 * File: exportHTML.tsx
 * Description: Function export tree HTML to HTML code
 * Author: Karolína Virágová, xvirag00
 * Created: 2026-03-10
 * ------------------------------------------------------------
 */

import type { Item } from "../Types/Types.tsx";
import { treeToHtml } from "../Tree/TreeToHTML.ts";

export function exportHtml(items: Item[]): string {
  return `<!DOCTYPE html>\n${treeToHtml(items)}`;
}
