import type { NodeRendererProps } from "react-arborist";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Item } from "../types";
import NodeAttributes from "./NodeAttributes";
import NodeStyleEditor from "./NodeStyleEditor";
import {
  Plus,
  Trash2,
  Pencil,
  Settings,
  Palette,
  ArrowDown,
  ArrowRight,
  Copy,
  Clipboard,
} from "lucide-react";
import { cloneNode, updateTree, TAGS_WITH_CHILDREN } from "../treeHelpers";
import PanelWithMenu from "./PanelWithMenu";

interface ExtraProps {
  updateNodes: (updater: (prev: Item[]) => Item[]) => void;
  cssContent: string;
  setCssContent: (css: string) => void;
  canOverrideReadonly: boolean;
}

let clipboard: Item | null = null;

type PanelType = "add" | "attr" | "style" | "style-from-attr" | null;

export default function TreeNode(props: NodeRendererProps<Item> & ExtraProps) {
  const {
    node,
    style,
    dragHandle,
    updateNodes,
    cssContent,
    setCssContent,
    canOverrideReadonly,
  } = props;

  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [showTextEdit, setShowTextEdit] = useState(false);
  const [filter, setFilter] = useState("");
  const [styleSelector, setStyleSelector] = useState("");
  const [localText, setLocalText] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelAnchorRef = useRef<HTMLElement | null>(null);
  const [panelPosition, setPanelPosition] = useState({
    top: 0,
    left: 0,
    placement: "bottom" as "top" | "bottom",
    anchorX: 24,
  });

  const isText =
    node.data.kind === "text" || node.data.name.startsWith("#text:");
  const isComment =
    node.data.kind === "comment" || node.data.kind === "doctype";
  const isLocked =
    !canOverrideReadonly && (node.data.readonly || node.data.containsReadonly);
  const tagName = node.data.name.replace(/[<>]/g, "");

  useEffect(() => {
    if (isText) {
      setLocalText(node.data.name.replace('#text: "', "").replace(/"$/, ""));
    }
    setStyleSelector(tagName);
  }, [node.data.name, isText, tagName]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setActivePanel(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  useLayoutEffect(() => {
    if (!activePanel || !panelRef.current || !panelAnchorRef.current) return;

    const anchor = panelAnchorRef.current.getBoundingClientRect();
    const panel = panelRef.current.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 8;
    const left = Math.min(
      Math.max(viewportPadding, anchor.right - panel.width),
      window.innerWidth - panel.width - viewportPadding,
    );
    const fitsBelow = anchor.bottom + gap + panel.height <= window.innerHeight;
    const placement = fitsBelow ? "bottom" : "top";
    const top = fitsBelow
      ? anchor.bottom + gap
      : Math.max(viewportPadding, anchor.top - panel.height - gap);
    const anchorX = Math.min(
      Math.max(18, anchor.left + anchor.width / 2 - left),
      panel.width - 18,
    );

    setPanelPosition({ top, left, placement, anchorX });
  }, [activePanel]);

  useEffect(() => {
    if (!activePanel) return;
    const close = () => setActivePanel(null);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [activePanel]);

  const commitText = () =>
    updateNodes((prev) =>
      updateTree(prev, node.id, (item) => ({
        ...item,
        name: `#text: "${localText}"`,
        text: localText,
        raw: undefined,
      })),
    );

  const handleCopy = () => {
    clipboard = node.data;
  };

  const handlePaste = () => {
    if (!clipboard || isLocked) return;

    const newNode = cloneNode(clipboard);

    updateNodes((prev) =>
      updateTree(prev, node.id, (item) => ({
        ...item,
        children: [...item.children, newNode],
      })),
    );
  };

  const handleAdd = (tag: string) => {
    if (isLocked) return;
    const newNode: Item =
      tag === "text"
        ? {
            id: crypto.randomUUID(),
            name: `#text: "New text"`,
            attributes: [],
            children: [],
          }
        : {
            id: crypto.randomUUID(),
            name: `<${tag}>`,
            attributes: [],
            children: [],
          };

    updateNodes((prev) =>
      updateTree(prev, node.id, (item) => ({
        ...item,
        children: [...item.children, newNode],
      })),
    );

    setFilter("");
  };

  const openStyleFromAttr = (selector: string) => {
    setStyleSelector(selector);
    setActivePanel("style");
  };

  const togglePanel = (
    panel: Exclude<PanelType, null>,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    panelAnchorRef.current = event.currentTarget;
    setActivePanel((current) => (current === panel ? null : panel));
  };

  const allowedChildren =
    TAGS_WITH_CHILDREN.find((t) => t.name === tagName)?.children || [];

  const hasChildren = node.children && node.children.length > 0;

  return (
    <div style={style} ref={dragHandle} className="ve-tree-node">
      {/* NODE HEADER */}
      <div
        className={`ve-node-row ${node.isSelected ? "is-selected" : ""} ${isLocked ? "is-readonly" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Expand/collapse toggle — only takes up space when has children */}
        <span className="ve-node-toggle-slot">
          {hasChildren && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                node.toggle();
              }}
              className="wda-icon-button ve-node-toggle"
            >
              {node.isOpen ? <ArrowDown size={12} /> : <ArrowRight size={12} />}
            </span>
          )}
        </span>

        {/* Tag name */}
        <span className="ve-node-tag">{node.data.name}</span>

        {/* Attributes — shown inline in muted color */}
        {node.data.attributes.length > 0 && (
          <span className="ve-node-attributes">
            {node.data.attributes
              .map((a) => `[${a.name}="${a.value}"]`)
              .join(" ")}
          </span>
        )}

        {/* Spacer */}
        <span className="ve-node-spacer" />

        {/* ACTIONS — right-aligned icon row */}
        <div className="ve-node-actions">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className="wda-icon-button ve-icon-button"
            title="Copy"
          >
            <Copy size={14} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePaste();
            }}
            className="wda-icon-button ve-icon-button"
            title="Paste"
          >
            <Clipboard size={14} />
          </button>

          {!isText && !isComment && !isLocked && (
            <button
              onClick={(event) => togglePanel("add", event)}
              className="wda-icon-button ve-icon-button is-positive"
              title="Add child element"
            >
              <Plus size={14} />
            </button>
          )}

          {!isText && !isComment && !isLocked && (
            <button
              onClick={(event) => togglePanel("style", event)}
              className="wda-icon-button ve-icon-button is-accent"
              title="Edit CSS"
            >
              <Palette size={14} />
            </button>
          )}

          {!isText && !isComment && !isLocked && (
            <button
              onClick={(event) => togglePanel("attr", event)}
              className="wda-icon-button ve-icon-button is-accent"
              title="Edit attributes"
            >
              <Settings size={14} />
            </button>
          )}

          {isText && !isLocked && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTextEdit((p) => !p);
              }}
              className="wda-icon-button ve-icon-button"
              title="Edit text"
            >
              <Pencil size={14} />
            </button>
          )}

          {!isLocked && !isComment && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                node.tree.delete(node.id);
              }}
              className="wda-icon-button ve-icon-button is-danger"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* TEXT EDIT */}
      {isText && !isLocked && showTextEdit && (
        <textarea
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={commitText}
          onClick={(e) => e.stopPropagation()}
          autoFocus
          className="wda-input ve-input ve-text-editor"
        />
      )}

      {activePanel &&
        createPortal(
          <div className="visual-editor-root wda-theme ve-popover-portal">
            <div
              ref={panelRef}
              className={`ve-popover is-${panelPosition.placement}`}
              style={
                {
                  top: panelPosition.top,
                  left: panelPosition.left,
                  "--ve-anchor-x": `${panelPosition.anchorX}px`,
                } as React.CSSProperties
              }
            >
              {activePanel === "add" && (
                <PanelWithMenu
                  activePanel={activePanel}
                  setActivePanel={setActivePanel}
                  title="Add element"
                  icon={<Plus size={14} />}
                >
                  <input
                    className="wda-input ve-input ve-search-input"
                    placeholder="Found element"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                  <div className="ve-option-list">
                    {allowedChildren
                      .filter((tag) =>
                        tag.toLowerCase().startsWith(filter.toLowerCase()),
                      )
                      .map((tag) => (
                        <button
                          key={tag}
                          onClick={() => handleAdd(tag)}
                          className="ve-list-option"
                        >
                          {tag === "text" ? "Text" : tag}
                        </button>
                      ))}
                  </div>
                </PanelWithMenu>
              )}
              {activePanel === "attr" && (
                <PanelWithMenu
                  activePanel={activePanel}
                  setActivePanel={setActivePanel}
                  title="Attributes"
                  icon={<Settings size={14} />}
                >
                  <NodeAttributes
                    node={node}
                    updateNodes={updateNodes}
                    tagName={tagName}
                    openStyleEditor={openStyleFromAttr}
                  />
                </PanelWithMenu>
              )}
              {(activePanel === "style" ||
                activePanel === "style-from-attr") && (
                <PanelWithMenu
                  activePanel={activePanel}
                  setActivePanel={setActivePanel}
                  title="CSS style"
                  icon={<Palette size={14} />}
                >
                  <NodeStyleEditor
                    selector={styleSelector}
                    cssContent={cssContent}
                    setCssContent={setCssContent}
                    canOverrideReadonly={canOverrideReadonly}
                  />
                </PanelWithMenu>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
