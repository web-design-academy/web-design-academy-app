import type { Attribute, Item } from "../types.ts";

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

function attributesEqual(left: Attribute[] = [], right: Attribute[] = []) {
  return (
    left.length === right.length &&
    left.every(
      (attribute, index) =>
        attribute.name === right[index]?.name &&
        attribute.value === right[index]?.value,
    )
  );
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function renderItem(item: Item): string {
  const leading = item.leading ?? "";
  const trailing = item.trailing ?? "";

  if (item.kind === "comment" || item.kind === "doctype") {
    return `${leading}${item.raw ?? item.name}${trailing}`;
  }

  if (item.kind === "text" || item.name.startsWith("#text:")) {
    const unchanged =
      item.text === item.originalText ||
      (item.text === undefined && item.name === item.originalName);
    const text =
      unchanged && item.raw !== undefined
        ? item.raw
        : (item.text ?? item.name.replace('#text: "', "").replace(/"$/, ""));
    return `${leading}${text}${trailing}`;
  }

  const tag = item.name.replace(/[<>]/g, "");
  const unchangedOpen =
    item.rawOpen &&
    item.name === item.originalName &&
    attributesEqual(item.attributes, item.originalAttributes);
  const attributes = item.attributes.length
    ? ` ${item.attributes
        .map((attribute) =>
          attribute.value === ""
            ? attribute.name
            : `${attribute.name}="${escapeAttribute(attribute.value)}"`,
        )
        .join(" ")}`
    : "";
  const open = unchangedOpen ? item.rawOpen : `<${tag}${attributes}>`;

  if (VOID_ELEMENTS.has(tag.toLowerCase())) {
    return `${leading}${open}${trailing}`;
  }

  const children = item.children.map(renderItem).join("");
  const close =
    item.rawClose && item.name === item.originalName
      ? item.rawClose
      : `</${tag}>`;
  return `${leading}${open}${children}${item.innerTrailing ?? ""}${close}${trailing}`;
}

export function exportHtml(items: Item[]): string {
  return items.map(renderItem).join("");
}
