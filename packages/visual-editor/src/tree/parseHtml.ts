import type { Attribute, Item } from "../types.js";

const TOKEN_PATTERN =
  /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/?[a-z][^>]*>|[^<]+|</gi;
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

type Context = { children: Item[]; owner?: Item; pending: string };

function parseAttributes(openTag: string): Attribute[] {
  const body = openTag.replace(/^<\s*[\w:-]+/, "").replace(/\/?>\s*$/, "");
  const attributes: Attribute[] = [];
  const pattern =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(body))) {
    attributes.push({
      name: match[1],
      value: match[2] ?? match[3] ?? match[4] ?? "",
    });
  }
  return attributes;
}

function markReadonlyContainers(items: Item[]): boolean {
  let hasReadonly = false;
  items.forEach((item) => {
    const childReadonly = markReadonlyContainers(item.children);
    item.containsReadonly = childReadonly;
    if (item.readonly || childReadonly) hasReadonly = true;
  });
  return hasReadonly;
}

export function parseHtmlToTree(html: string): Item[] {
  if (!html) return [];

  const root: Context = { children: [], pending: "" };
  const stack: Context[] = [root];
  let readonlyDepth = 0;
  const tokens = html.match(TOKEN_PATTERN) ?? [];

  const append = (item: Item) => {
    const context = stack[stack.length - 1];
    item.leading = context.pending;
    context.pending = "";
    context.children.push(item);
  };

  tokens.forEach((token) => {
    const context = stack[stack.length - 1];

    if (!token.startsWith("<")) {
      if (!token.trim()) {
        context.pending += token;
        return;
      }
      append({
        id: crypto.randomUUID(),
        kind: "text",
        name: `#text: "${token.trim()}"`,
        text: token,
        originalText: token,
        raw: token,
        attributes: [],
        children: [],
        readonly: readonlyDepth > 0,
      });
      return;
    }

    if (/^<!--/.test(token)) {
      const marker = token.trim().toLowerCase();
      const isStart = marker === "<!-- readonly:start -->";
      const isEnd = marker === "<!-- readonly:end -->";
      append({
        id: crypto.randomUUID(),
        kind: "comment",
        name: marker,
        raw: token,
        attributes: [],
        children: [],
        readonly: isStart || isEnd || readonlyDepth > 0,
      });
      if (isStart) readonlyDepth += 1;
      if (isEnd) readonlyDepth = Math.max(0, readonlyDepth - 1);
      return;
    }

    if (/^<!doctype/i.test(token)) {
      append({
        id: crypto.randomUUID(),
        kind: "doctype",
        name: "<!doctype>",
        raw: token,
        attributes: [],
        children: [],
        readonly: readonlyDepth > 0,
      });
      return;
    }

    const closeMatch = token.match(/^<\/\s*([\w:-]+)/);
    if (closeMatch) {
      const tagName = closeMatch[1].toLowerCase();
      for (let index = stack.length - 1; index > 0; index -= 1) {
        const owner = stack[index].owner;
        if (owner?.name === `<${tagName}>`) {
          owner.innerTrailing = stack[index].pending;
          owner.rawClose = token;
          stack.length = index;
          break;
        }
      }
      return;
    }

    const openMatch = token.match(/^<\s*([\w:-]+)/);
    if (!openMatch) {
      context.pending += token;
      return;
    }

    const tagName = openMatch[1].toLowerCase();
    const attributes = parseAttributes(token);
    const item: Item = {
      id: crypto.randomUUID(),
      kind: "element",
      name: `<${tagName}>`,
      originalName: `<${tagName}>`,
      attributes,
      originalAttributes: attributes.map((attribute) => ({ ...attribute })),
      children: [],
      rawOpen: token,
      readonly: readonlyDepth > 0,
    };
    append(item);

    if (!token.endsWith("/>") && !VOID_ELEMENTS.has(tagName)) {
      stack.push({ children: item.children, owner: item, pending: "" });
    }
  });

  while (stack.length > 1) {
    const context = stack.pop();
    if (context?.owner) context.owner.innerTrailing = context.pending;
  }
  if (root.pending && root.children.length > 0) {
    root.children[root.children.length - 1].trailing = root.pending;
  }

  markReadonlyContainers(root.children);
  return root.children;
}
