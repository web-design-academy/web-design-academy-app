/**
 * ------------------------------------------------------------
 * File: MoveHandler.ts
 * Description:  * Moves nodes in a tree structure to a new parent and position.
 * Author: Karolína Virágová, xvirag00
 * Created: 2026-03-10
 * ------------------------------------------------------------
 */
import type { Item } from "../Types/Types.ts";

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
  index: number
): Item[] {
  // Stores nodes that will be moved
  let movedNodes: Item[] = [];

  /**
   * 
   * @param list 
   * @returns 
   */
  const removeNodes = (list: Item[]): Item[] =>
      list.filter(item => {
      // If the current node is one of the dragged nodes, remove it
      if (dragIds.includes(item.id)) {
        movedNodes.push(item);
        return false;
      }
      // Otherwise continue searching in children
      item.children = removeNodes(item.children);
      return true;
    });

  let newNodes = removeNodes([...nodes]);

  /**
   * 
   * @param list 
   * @returns 
   */
  const insertNodes = (list: Item[]): Item[] =>
    list.map(item => {
      if (item.id === parentId) {
        const c = [...item.children];
        c.splice(index, 0, ...movedNodes);
        return { ...item, children: c };
      }
      return { ...item, children: insertNodes(item.children) };
    });

  return parentId ? insertNodes(newNodes) : [...newNodes, ...movedNodes];
}
