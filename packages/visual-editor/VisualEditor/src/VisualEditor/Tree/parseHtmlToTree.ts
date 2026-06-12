/**
 * ------------------------------------------------------------
 * File: parseHtmlToTree.ts
 * Description: The function converts the HTML code into HTML tree. 
 * Author: Karolína Virágová, xvirag00
 * Created: 2026-03-10
 * ------------------------------------------------------------
 */

import type { Item, Attribute } from "../Types/Types.js";

export function parseHtmlToTree(html: string): Item[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  function walk(node: Node): Item {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      return {
        id: Math.random().toString(36).substring(2, 9),
        name: text ? `#text: "${text}"` : `#text: ""`,
        attributes: [],
        children: [],
      };
    }

    const element = node as Element;
    const attrs: Attribute[] = Array.from(element.attributes).map(attr => ({
      name: attr.name,
      value: attr.value,
    }));

    const children = Array.from(element.childNodes)
      .map(walk)
      .filter(child => child.name !== `#text: ""`);

    return {
      id: Math.random().toString(36).substring(2, 9),
      name: `<${element.tagName.toLowerCase()}>`,
      attributes: attrs,
      children,
    };
  }

  if (!html.trim()) {
    return [];
  }

  const hasHtmlTag = /<html/i.test(html);
  if (hasHtmlTag) {
    return [walk(doc.documentElement)];
  } else {
    return Array.from(doc.body.childNodes)
      .map(walk)
      .filter(child => child.name !== `#text: ""`);
  }
}
