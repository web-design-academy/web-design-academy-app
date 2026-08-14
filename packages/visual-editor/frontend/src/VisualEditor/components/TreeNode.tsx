import type { NodeRendererProps } from "react-arborist";
import { useState, useEffect, useRef } from "react";
import type { Item } from "../Types/Types";
import NodeAttributes from "./NodeAttributes";
import NodeStyleEditor from "./NodeStyleEditor";
import { Plus, Trash2, Pencil, Settings, Palette } from "lucide-react";
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
    if (isText) setLocalText(node.data.name.replace('#text: "', "").replace(/"$/, ""));
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
    updateNodes(prev => updateTree(prev, node.id, item => ({ ...item, name: `#text: "${localText}"` })));

  const handleCopy = () => { clipboard = node.data; };
  const handlePaste = () => {
    if (!clipboard) return;
    const newNode = cloneNode(clipboard);
    updateNodes(prev => updateTree(prev, node.id, item => ({ ...item, children: [...item.children, newNode] })));
  };

  const handleAdd = (tag: string) => {
    const newNode: Item =
      tag === "text"
        ? { id: crypto.randomUUID(), name: `#text: "New text"`, attributes: [], children: [] }
        : { id: crypto.randomUUID(), name: `<${tag}>`, attributes: [], children: [] };

    updateNodes(prev => updateTree(prev, node.id, item => ({ ...item, children: [...item.children, newNode] })));
    setFilter("");
  };

  const openStyleFromAttr = (selector: string) => {
    setStyleSelector(selector);
    setActivePanel("style");
  };

  const allowedChildren = TAGS_WITH_CHILDREN.find(t => t.name === tagName)?.children || [];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "c" && node.isSelected) { e.preventDefault(); handleCopy(); }
      if (e.ctrlKey && e.key === "v" && node.isSelected) { e.preventDefault(); handlePaste(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [node]);

  const renderOverlay = () => activePanel ? <div className="fixed inset-0 bg-black/40 z-40"></div> : null;

  return (
    <div style={style} ref={dragHandle} onClick={() => node.toggle()} className="flex flex-col gap-2 p-2 m-2 relative">
      {renderOverlay()}

      {/* Node Header */}
      <div className={`flex justify-between items-center min-w-80 max-w-100 px-3 py-1 rounded-lg
  ${isDark
    ? node.isSelected
      ? "bg-zinc-700 text-white ring-2 ring-green-500"
      : "bg-zinc-800 text-white hover:bg-zinc-700"
    : node.isSelected
      ? "bg-zinc-200 text-black ring-2 ring-green-500"
      : "bg-white text-black hover:bg-zinc-100 border"
  }`}>
        <span className="flex-1 truncate pr-2 flex items-center gap-2">
          <span title={node.data.name} className="truncate">
            {node.data.name.length > 30 ? node.data.name.slice(0,30)+"..." : node.data.name}
          </span>
          {node.data.attributes.length > 0 && (
           <span className={`text-xs truncate ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
              [{node.data.attributes.map(a => `${a.name}="${a.value}"`).join(" ")}]
            </span>
          )}
        </span>
        <div className="flex gap-2 text-sm">
          {!isText && <button onClick={e => { e.stopPropagation(); setActivePanel(p => p==="add"?null:"add"); }} className="hover:text-green-900 transition"><Plus size={16} /></button>}
          {!isText && <button onClick={e => { e.stopPropagation(); setStyleSelector(tagName); setActivePanel(p=>p==="style"?null:"style"); }} className="hover:text-green-900 transition"><Palette size={16} /></button>}
          {!isText && <button onClick={e => { e.stopPropagation(); setActivePanel(p => p==="attr"?null:"attr"); }} className="hover:text-green-900 transition"><Settings size={16} /></button>}
          <button onClick={e=>{ e.stopPropagation(); node.tree.delete(node.id); }} className="hover:text-red-500 transition"><Trash2 size={16} /></button>
          {isText && <button onClick={e=>{ e.stopPropagation(); setShowTextEdit(p=>!p); }} className="hover:text-green-900 transition"><Pencil size={16} /></button>}
        </div>
      </div>

      {/* Text Editor */}
      {isText && showTextEdit && (
        <textarea
          value={localText}
          onChange={e=>setLocalText(e.target.value)}
          onBlur={commitText}
          onClick={e=>e.stopPropagation()}
          onKeyDown={e=>e.stopPropagation()}
          autoFocus
         className={`p-2 rounded border
  ${isDark
    ? "bg-zinc-900 text-white border-zinc-700"
    : "bg-white text-black border-zinc-300"
  }`}
        />
      )}

      {/* Panely s menu */}
      {activePanel && (
        <div ref={panelRef} className="absolute top-full left-10 mt-1 z-50">
          {activePanel === "add" && (
            <PanelWithMenu activePanel={activePanel} setActivePanel={setActivePanel} title="Přidat element" icon={<Plus size={14}/>}  isDark={isDark} >
              <input
                className={`w-full p-2 rounded outline-none
                ${isDark
                  ? "bg-zinc-800 text-white"
                  : "bg-white text-black border border-zinc-300"
                }`}
                placeholder="Vyhledat..."
                value={filter}
                onChange={e=>setFilter(e.target.value)}
              />
              <div className="max-h-52 overflow-y-auto flex flex-col">
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