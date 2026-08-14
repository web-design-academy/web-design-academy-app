import type { Item } from "./types";
import rawTags from "./tags.json";

export const cloneNode = (node: Item): Item => ({
  ...node,
  id: crypto.randomUUID(),
  children: node.children.map(cloneNode),
});

export type AttributeDefinition = {
  name: string;
  values?: string[];
};

export type TagDefinition = {
  name: string;
  children?: string[];
  attributes: AttributeDefinition[];
};

export function normalizeTags(rawTags: any[]): TagDefinition[] {
  return rawTags.map((tag) => ({
    name: tag.name,
    children: tag.children ?? [],
    attributes: (tag.attributes ?? []).map((attr: any) => ({
      name: attr.name,
      values: attr.values
        ? attr.values.flat().map((v: any) => String(v))
        : undefined,
    })),
  }));
}

export const TAGS_WITH_CHILDREN: TagDefinition[] = normalizeTags(rawTags);

export const updateTree = (
  items: Item[],
  targetId: string,
  updater: (i: Item) => Item,
): Item[] =>
  items.map((i) =>
    i.id === targetId
      ? updater(i)
      : { ...i, children: updateTree(i.children, targetId, updater) },
  );
