/**
 * ------------------------------------------------------------
 * File: useHistory.ts
 * Description: 
 * Author: Karolína Virágová, xvirag00
 * Created: 2026-03-10
 * ------------------------------------------------------------
 */

import { useState, useCallback } from "react";
import type { Item } from "./Types/Types";

/**
 * Custom hook that manages a history stack for tree state.
 * It enables undo/redo functionality and controlled updates of the node tree.
 *
 * @param initialTree - Initial tree structure parsed from HTML
 * @param limit - Maximum number of history states stored (default: 50)
 */
export function useHistory(initialTree: Item[], limit = 50) {
  
  //Stores all historical versions of the tree
  const [history, setHistory] = useState<Item[][]>([structuredClone(initialTree)]);

  // Index pointing to the currently active history state
  const [historyIndex, setHistoryIndex] = useState(0);

  // Current nodes are derived from the history stack
  const nodes = history[historyIndex];

  /**
   * Updates the tree state and pushes the new state into the history stack.
   * The updater function receives the previous tree and returns the updated one.
   */
  const updateNodes = useCallback((updater: (prev: Item[]) => Item[]) => {
    setHistory(prevHistory => {
      const current = prevHistory[historyIndex];
      const updated = structuredClone(updater(current));

      const sliced = prevHistory.slice(0, historyIndex + 1);
      const next = [...sliced, updated];

      if (next.length > limit) next.shift();

      return next;
    });

    setHistoryIndex(i => Math.min(i + 1, limit - 1));
  }, [historyIndex, limit]);

  /**
   * Moves one step back in the history stack.
   */
  const undo = useCallback(() => {
    setHistoryIndex(i => Math.max(i - 1, 0));
  }, []);

  /**
   * Moves one step forward in the history stack.
   */
  const redo = useCallback(() => {
    setHistoryIndex(i => Math.min(i + 1, history.length - 1));
  }, [history.length]);


   /**
   * Replaces the entire tree and resets history.
   * Used when external content (e.g., scenario HTML) changes.
   */
  const setNodes = useCallback((newTree: Item[]) => {
    setHistory([structuredClone(newTree)]);
    setHistoryIndex(0);
  }, []);

  return { nodes, updateNodes, undo, redo, setNodes };
}