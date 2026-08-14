/**
 * ------------------------------------------------------------
 * File: VisualEditor.tsx
 * Description: Rendering tree structure
 * Author: Karolína Virágová, xvirag00
 * Created: 2026-03-10
 * ------------------------------------------------------------
 */

import { useEffect, useMemo, useCallback, useRef, useState } from "react";
import { Tree } from "react-arborist";
import TreeNode from "./components/TreeNode";
import type { VisualEditorProps, Item } from "./Types/Types";
import { parseHtmlToTree } from "./Tree/parseHtmlToTree";
import { exportHtml } from "./components/exportHTML";
import { handleDelete } from "./Handlers/DeleteHandler";
import { handleMove } from "./Handlers/MoveHandler";
import { useHistory } from "./useHistory";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

export default function VisualEditor({
  content,
  setContent,
  cssContent,
  setCssContent,
  isDark
}: VisualEditorProps) {

const containerRef = useRef<HTMLDivElement | null>(null);
const [height, setHeight] = useState(500);

useEffect(() => {
  if (!containerRef.current) return;
  const resizeObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
      if (entry.contentRect.height > 0) {
        setHeight(entry.contentRect.height);
      }
    }
  });
  resizeObserver.observe(containerRef.current);
  return () => resizeObserver.disconnect();
}, []);

const initialTree = useMemo(() => parseHtmlToTree(content), []);
const { nodes, updateNodes, undo, redo, setNodes } = useHistory(initialTree, 50);

const newHtml = useMemo(() => exportHtml(nodes), [nodes]);

const internalUpdate = useRef(false);

useEffect(() => {
  if (newHtml !== content) {
    internalUpdate.current = true;
    setContent(newHtml);
  }
}, [newHtml]);

useKeyboardShortcuts({ undo, redo });

useEffect(() => {
  if (!internalUpdate.current) {
    setNodes(parseHtmlToTree(content));
  }
  internalUpdate.current = false;
}, [content]);

  const handleDeleteCallback = useCallback(
    ({ ids }: { ids: string[] }) => {
      updateNodes(prev => handleDelete(ids, prev));
    },
    [updateNodes]
  );

  const handleMoveCallback = useCallback(
    ({ dragIds, parentId, index }: { dragIds: string[]; parentId: string | null; index: number }) => {
      updateNodes(prev => handleMove(prev, dragIds, parentId, index));
    },
    [updateNodes]
  );

  const renderNode = useCallback(
    (props: any) => (
      <TreeNode
        {...props}
        updateNodes={updateNodes}
        cssContent={cssContent}
        setCssContent={setCssContent}
        isDark={isDark} 
      />
    ),
    [updateNodes, cssContent, setCssContent, isDark]
  );

  return (
    <div ref={containerRef} className={`visual-editor-root h-full w-full overflow-hidden
      ${isDark
        ? "bg-zinc-900"
        : "bg-white"
      }`}
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
        padding={25}
        
      >
        {renderNode}
      </Tree>
    </div>
  );
}