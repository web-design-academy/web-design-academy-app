/**
 * ------------------------------------------------------------
 * File: DeleteHandler.ts
 * Description:
 * Author: Karolína Virágová, xvirag00
 * Created: 2026-03-10
 * ------------------------------------------------------------
 */
import type { Item } from "../types.ts";

/**
 *
 * @param ids
 * @param items
 * @returns
 */
export function handleDelete(
  ids: string[],
  items: Item[],
  canOverrideReadonly = false,
): Item[] {
  /**
   *
   * @param list
   * @returns
   */
  const removeNode = (list: Item[]): Item[] =>
    list
      .filter(
        (item) =>
          !ids.includes(item.id) ||
          (!canOverrideReadonly && (item.readonly || item.containsReadonly)),
      )
      .map((item) => ({ ...item, children: removeNode(item.children) }));

  //
  return removeNode(items);
}
