import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tree } from "react-arborist";
import TreeNode from "./components/TreeNode";
import type { VisualEditorProps, Item } from "./types";
import { parseHtmlToTree } from "./tree/parseHtml";
import { exportHtml } from "./tree/serializeHtml";
import { handleDelete } from "./handlers/deleteNode";
import { handleMove } from "./handlers/moveNode";
import { useHistory } from "./useHistory";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

export default function VisualEditor({
  html,
  css,
  onHtmlChange,
  onCssChange,
  isDark,
  canOverrideReadonly = false,
}: VisualEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(500);
  const initialTree = useMemo(() => parseHtmlToTree(html), []);
  const lastEmittedHtmlRef = useRef(html);
  const emitTree = useCallback(
    (nextNodes: Item[]) => {
      const nextHtml = exportHtml(nextNodes);
      lastEmittedHtmlRef.current = nextHtml;
      onHtmlChange(nextHtml);
    },
    [onHtmlChange],
  );
  const {
    nodes,
    updateNodes: updateHistory,
    undo,
    redo,
    setNodes,
  } = useHistory(initialTree, 50, emitTree);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.contentRect.height > 0) setHeight(entry.contentRect.height);
      });
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (html === lastEmittedHtmlRef.current) return;
    setNodes(parseHtmlToTree(html));
    lastEmittedHtmlRef.current = html;
  }, [html, setNodes]);

  const commitTree = useCallback(
    (updater: (previous: Item[]) => Item[]) => {
      updateHistory((previous) => {
        const next = updater(previous);
        emitTree(next);
        return next;
      });
    },
    [emitTree, updateHistory],
  );

  useKeyboardShortcuts({ undo, redo });

  const handleDeleteCallback = useCallback(
    ({ ids }: { ids: string[] }) => {
      commitTree((previous) =>
        handleDelete(ids, previous, canOverrideReadonly),
      );
    },
    [canOverrideReadonly, commitTree],
  );

  const handleMoveCallback = useCallback(
    ({
      dragIds,
      parentId,
      index,
    }: {
      dragIds: string[];
      parentId: string | null;
      index: number;
    }) => {
      commitTree((previous) =>
        handleMove(previous, dragIds, parentId, index, canOverrideReadonly),
      );
    },
    [canOverrideReadonly, commitTree],
  );

  const renderNode = useCallback(
    (props: any) => (
      <TreeNode
        {...props}
        updateNodes={commitTree}
        cssContent={css}
        setCssContent={onCssChange}
        canOverrideReadonly={canOverrideReadonly}
      />
    ),
    [canOverrideReadonly, commitTree, css, onCssChange],
  );

  return (
    <div
      ref={containerRef}
      className={`visual-editor-root wda-theme ${isDark ? "is-dark" : ""}`}
    >
      <Tree<Item>
        data={nodes}
        onDelete={handleDeleteCallback}
        onMove={handleMoveCallback}
        width="100%"
        height={height}
        indent={24}
        rowHeight={36}
        paddingTop={30}
        paddingBottom={10}
        openByDefault
      >
        {renderNode}
      </Tree>
    </div>
  );
}
