/**
 * ------------------------------------------------------------
 * File: TreeToHTML.tsx
 * Description: The function converts the HTML tree into HTML code. 
 * Author: Karolína Virágová, xvirag00
 * Created: 2026-03-10
 * ------------------------------------------------------------
 */

import type { Item } from "../Types/Types.ts";

export function treeToHtml(items: Item[], depth = 0): string {
  const indent = "  ".repeat(depth);

  return items
    .map(item => {
      if (item.name.startsWith("#text:")) {
        const text = item.name.replace('#text: "', "").replace(/"$/, "");
        return `${indent}${text}`;
      }

      const tag = item.name.replace(/[<>]/g, "");
      const attrs =
        item.attributes.length
          ? " " + item.attributes.map(a => `${a.name}="${a.value}"`).join(" ")
          : "";

      const children = treeToHtml(item.children, depth + 1);

      if (children.trim() === "") {
        return `${indent}<${tag}${attrs}></${tag}>`;
      }

      return `${indent}<${tag}${attrs}>\n${children}\n${indent}</${tag}>`;
    })
    .join("\n");
}
