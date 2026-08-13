/**
 * ------------------------------------------------------------
 * File: MoveHandler.ts
 * Description:  * Moves nodes in a tree structure to a new parent and position.
 * Author: Karolína Virágová, xvirag00
 * Created: 2026-03-10
 * ------------------------------------------------------------
 */
import type { Item } from "../types.ts";

/**
 *
 * @param nodes - The full tree of items
 * @param dragIds - IDs of nodes that are being moved
 * @param parentId - ID of the new parent node (null = move to root)
 * @param index - Position where the nodes should be inserted
 * @returns Updated tree with moved nodes
 */
export function handleMove(
  nodes: Item[],
  dragIds: string[],
  parentId: string | null,
  index: number,
  canOverrideReadonly = false,
): Item[] {
  const findNode = (items: Item[], id: string): Item | undefined => {
    for (const item of items) {
      if (item.id === id) return item;
      const child = findNode(item.children, id);
      if (child) return child;
    }
    return undefined;
  };

  const dragged = dragIds
    .map((id) => findNode(nodes, id))
    .filter((item): item is Item => Boolean(item));
  const target = parentId ? findNode(nodes, parentId) : undefined;
  const touchesReadonly = (item: Item | undefined) =>
    Boolean(item?.readonly || item?.containsReadonly);

  if (
    dragged.length !== dragIds.length ||
    (!canOverrideReadonly &&
      (dragged.some(touchesReadonly) || touchesReadonly(target)))
  ) {
    return nodes;
  }

  const draggedIds = new Set(dragIds);
  const removeNodes = (items: Item[]): Item[] =>
    items
      .filter((item) => !draggedIds.has(item.id))
      .map((item) => ({ ...item, children: removeNodes(item.children) }));

  const withoutDragged = removeNodes(nodes);
  if (!parentId) {
    const next = [...withoutDragged];
    next.splice(index, 0, ...dragged);
    return next;
  }

  const insertNodes = (items: Item[]): Item[] =>
    items.map((item) => {
      if (item.id === parentId) {
        const children = [...item.children];
        children.splice(index, 0, ...dragged);
        return { ...item, children };
      }
      return { ...item, children: insertNodes(item.children) };
    });

  return insertNodes(withoutDragged);
}
