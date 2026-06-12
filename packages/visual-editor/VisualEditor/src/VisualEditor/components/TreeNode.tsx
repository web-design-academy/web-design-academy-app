import type { NodeRendererProps } from "react-arborist";
import { useState, useEffect, useRef } from "react";
import type { Item } from "../Types/Types";
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
  Clipboard
} from "lucide-react";
import { cloneNode, updateTree, TAGS_WITH_CHILDREN } from "../Node/TreeNodeHelpers";
import PanelWithMenu from "./PanelWithMenu";

interface ExtraProps {
  updateNodes: (updater: (prev: Item[]) => Item[]) => void;
  cssContent: string;
  setCssContent: React.Dispatch<React.SetStateAction<string>>;
  isDark: boolean;
}

let clipboard: Item | null = null;

export type PanelType = "add" | "attr" | "style" | "style-from-attr" | null;

export default function TreeNode(props: NodeRendererProps<Item> & ExtraProps) {
  const { node, style, dragHandle, updateNodes, cssContent, setCssContent, isDark } = props;

  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [showTextEdit, setShowTextEdit] = useState(false);
  const [filter, setFilter] = useState("");
  const [styleSelector, setStyleSelector] = useState("");
  const [localText, setLocalText] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);

  const isText = node.data.name.startsWith("#text:");
  const tagName = node.data.name.replace(/[<>]/g, "");

  useEffect(() => {
    if (isText) {
      setLocalText(node.data.name.replace('#text: "', "").replace(/"$/, ""));
    }
    setStyleSelector(tagName);
  }, [node.data.name, isText, tagName]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
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

  const commitText = () =>
    updateNodes(prev =>
      updateTree(prev, node.id, item => ({
        ...item,
        name: `#text: "${localText}"`
      }))
    );

  const handleCopy = () => {
    clipboard = node.data;
  };

  const handlePaste = () => {
    if (!clipboard) return;

    const newNode = cloneNode(clipboard);

    updateNodes(prev =>
      updateTree(prev, node.id, item => ({
        ...item,
        children: [...item.children, newNode]
      }))
    );
  };

  const handleAdd = (tag: string) => {
    const newNode: Item =
      tag === "text"
        ? { id: crypto.randomUUID(), name: `#text: "New text"`, attributes: [], children: [] }
        : { id: crypto.randomUUID(), name: `<${tag}>`, attributes: [], children: [] };

    updateNodes(prev =>
      updateTree(prev, node.id, item => ({
        ...item,
        children: [...item.children, newNode]
      }))
    );

    setFilter("");
  };

  const openStyleFromAttr = (selector: string) => {
    setStyleSelector(selector);
    setActivePanel("style");
  };

  const allowedChildren =
    TAGS_WITH_CHILDREN.find(t => t.name === tagName)?.children || [];

  const renderOverlay = () =>
    activePanel ? <div className="fixed inset-0 bg-black/40 z-40" /> : null;

  const hasChildren = node.children && node.children.length > 0;

  return (
    <div style={style} ref={dragHandle} className="relative">
      {renderOverlay()}

      {/* NODE HEADER */}
      <div
        className={`flex items-center w-full px-3 py-1.5 border-b transition-colors
        ${
          isDark
            ? node.isSelected
              ? "bg-zinc-700 text-white border-zinc-600"
              : "bg-zinc-900 text-zinc-100 border-zinc-700/60 hover:bg-zinc-800"
            : node.isSelected
              ? "bg-blue-50 text-zinc-900 border-zinc-200"
              : "bg-white text-zinc-800 border-zinc-100 hover:bg-zinc-50"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Expand/collapse toggle — only takes up space when has children */}
        <span className="w-5 flex-shrink-0 flex items-center justify-center">
          {hasChildren && (
            <span
              onClick={(e) => { e.stopPropagation(); node.toggle(); }}
              className={`cursor-pointer transition-colors ${
                isDark ? "text-zinc-400 hover:text-zinc-100" : "text-zinc-400 hover:text-zinc-700"
              }`}
            >
              {node.isOpen ? <ArrowDown size={12} /> : <ArrowRight size={12} />}
            </span>
          )}
        </span>

        {/* Tag name */}
        <span className={`font-mono text-sm font-medium ${
          isDark ? "text-sky-300" : "text-zinc-800"
        }`}>
          {node.data.name}
        </span>

        {/* Attributes — shown inline in muted color */}
        {node.data.attributes.length > 0 && (
          <span className={`ml-2 text-xs font-mono truncate max-w-xs ${
            isDark ? "text-amber-300/80" : "text-indigo-500"
          }`}>
            {node.data.attributes.map(a => `[${a.name}="${a.value}"]`).join(" ")}
          </span>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* ACTIONS — right-aligned icon row */}
        <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${
          node.isSelected ? "opacity-100" : ""
        }`}
          style={{ opacity: 1 }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            className={`p-1 rounded transition-colors ${
              isDark ? "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700" : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
            }`}
            title="Copy">
            <Copy size={14} />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); handlePaste(); }}
            className={`p-1 rounded transition-colors ${
              isDark ? "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700" : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
            }`}
            title="Paste">
            <Clipboard size={14} />
          </button>

          {!isText && (
            <button
              onClick={(e) => { e.stopPropagation(); setActivePanel(p => p === "add" ? null : "add"); }}
              className={`p-1 rounded transition-colors ${
                isDark ? "text-zinc-400 hover:text-emerald-400 hover:bg-zinc-700" : "text-zinc-400 hover:text-emerald-600 hover:bg-zinc-100"
              }`}
              title="Add child element">
              <Plus size={14} />
            </button>
          )}

          {!isText && (
            <button
              onClick={(e) => { e.stopPropagation(); setActivePanel(p => p === "style" ? null : "style"); }}
              className={`p-1 rounded transition-colors ${
                isDark ? "text-zinc-400 hover:text-violet-400 hover:bg-zinc-700" : "text-zinc-400 hover:text-violet-600 hover:bg-zinc-100"
              }`}
              title="Edit CSS">
              <Palette size={14} />
            </button>
          )}

          {!isText && (
            <button
              onClick={(e) => { e.stopPropagation(); setActivePanel(p => p === "attr" ? null : "attr"); }}
              className={`p-1 rounded transition-colors ${
                isDark ? "text-zinc-400 hover:text-sky-400 hover:bg-zinc-700" : "text-zinc-400 hover:text-sky-600 hover:bg-zinc-100"
              }`}
              title="Edit attributes">
              <Settings size={14} />
            </button>
          )}

          {isText && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowTextEdit(p => !p); }}
              className={`p-1 rounded transition-colors ${
                isDark ? "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700" : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              }`}
              title="Edit text">
              <Pencil size={14} />
            </button>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); node.tree.delete(node.id); }}
            className={`p-1 rounded transition-colors ${
              isDark ? "text-zinc-400 hover:text-red-400 hover:bg-zinc-700" : "text-zinc-400 hover:text-red-500 hover:bg-zinc-100"
            }`}
            title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* TEXT EDIT */}
      {isText && showTextEdit && (
        <textarea
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={commitText}
          onClick={(e) => e.stopPropagation()}
          autoFocus
          className={`p-2 rounded border z-50 ${
            isDark
              ? "bg-zinc-900 text-white border-zinc-700"
              : "bg-white text-black border-zinc-300"
          }`}
        />
      )}

       {/* Panely with menu */}
      {activePanel && (
        <div ref={panelRef} className="absolute top-full left-10 mt-1 z-50">
          {activePanel === "add" && (
            <PanelWithMenu activePanel={activePanel} setActivePanel={setActivePanel} title="Přidat element" icon={<Plus size={14}/>}  isDark={isDark} >
              <input
                className={`w-full p-2 rounded outline-none  border-2 border-white
                ${isDark
                  ? "bg-zinc-800 text-white"
                  : "bg-white text-black border border-zinc-300"
                }`}
                placeholder="Found element"
                value={filter}
                onChange={e=>setFilter(e.target.value)}
              />
              <div className="max-h-52 overflow-y-auto flex flex-col bg-zinc-800">
                {allowedChildren.filter(tag => tag.toLowerCase().startsWith(filter.toLowerCase())).map(tag=>(
                  <button
                    key={tag}
                    onClick={() => handleAdd(tag)}
                    className={`text-left px-2 py-1 rounded transition
                      ${
                        isDark
                          ? "hover:bg-zinc-700 text-white"
                          : "hover:bg-zinc-200 text-black"
                      }`}
                  >                  
                    {tag==="text"?"Text":tag}
                  </button>
                ))}
              </div>
            </PanelWithMenu>
          )}
          {activePanel === "attr" && (
            <PanelWithMenu activePanel={activePanel} setActivePanel={setActivePanel} title="Atributy" icon={<Settings size={14} />}  isDark={isDark} >
              <NodeAttributes node={node} updateNodes={updateNodes} tagName={tagName} cssContent={cssContent} setCssContent={setCssContent} openStyleEditor={openStyleFromAttr} isDark={isDark}  />
            </PanelWithMenu>
          )}
          {(activePanel === "style" || activePanel === "style-from-attr") && (
            <PanelWithMenu activePanel={activePanel} setActivePanel={setActivePanel} title="CSS Styl" icon={<Palette size={14} />}  isDark={isDark} >
              <NodeStyleEditor selector={styleSelector} cssContent={cssContent} setCssContent={setCssContent} isDark={isDark} />
            </PanelWithMenu>
          )}
        </div>
      )}
    </div>
  );
}