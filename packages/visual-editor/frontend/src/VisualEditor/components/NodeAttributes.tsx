// Refactored version - logic preserved, simplified & unified
import type { Item } from "../Types/Types.js";
import type { NodeApi } from "react-arborist";
import { useState, useMemo } from "react";
import tags from "../Node/tags.json";
import { Plus, Trash2, Pencil, Palette } from "lucide-react";

type Props = {
  node: NodeApi<Item>;
  updateNodes: (updater: (prev: Item[]) => Item[]) => void;
  tagName: string;
  cssContent: string; // ✅ add this
  setCssContent: React.Dispatch<React.SetStateAction<string>>; // ✅ and this
  openStyleEditor: (selector: string) => void;
  isDark: boolean;
};

const ATTRIBUTE_LIMITS: Record<string, number | null> = {
  id: 1,
  class: null,
  title: 1,
  style: null,
  src: 1,
  alt: 1,
  width: 1,
  height: 1,
  href: 1,
  target: 1,
  type: 1,
  placeholder: 1,
  value: 1,
  name: 1,
  disabled: 1
};

const GLOBAL_ATTRIBUTES = [
  "id","class","style","title","lang","dir","hidden","tabindex",
  "contenteditable","draggable","spellcheck"
];

const STYLEABLE_ATTRS = ["id", "class", "style"];

export default function NodeAttributes({ node, updateNodes, tagName, openStyleEditor, isDark }: Props) {
  const [editing, setEditing] = useState<{ attr: string; val: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeAttr, setActiveAttr] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [filter, setFilter] = useState("");

  const getTagAttributes = (tag: string) => {
    return (tags as any[]).find((t) => t.name === tag)?.attributes ?? [];
  };

  const validAttributes = useMemo(() =>
    Array.from(new Set([
      ...GLOBAL_ATTRIBUTES,
      ...getTagAttributes(tagName).map((a: any) => a.name)
    ])), [tagName]
  );

  const filteredAttributes = validAttributes.filter(a =>
    a.toLowerCase().includes(filter.toLowerCase()) &&
    !node.data.attributes.some(attr => attr.name === a)
  );

  const updateTree = (items: Item[], id: string, updater: (i: Item) => Item): Item[] =>
    items.map(item =>
      item.id === id
        ? updater(item)
        : { ...item, children: item.children?.length ? updateTree(item.children, id, updater) : item.children }
    );

  const splitValues = (val: string) => val.split(/\s+/).filter(Boolean);

  const addValue = (existing: string, val: string, max: number | null) => {
    const values = splitValues(existing);

    if (max !== null && values.length >= max) {
      setError(`Atribut může mít max ${max} hodnot.`);
      return existing;
    }

    if (values.includes(val)) return existing;

    return [...values, val].join(" ");
  };

  const updateAttr = (attr: string, fn: (val: string) => string) => {
    updateNodes(prev => updateTree(prev, node.id, item => ({
      ...item,
      attributes: item.attributes.map(a =>
        a.name === attr ? { ...a, value: fn(a.value) } : a
      )
    })));
  };

  const addAttribute = (attr: string) => {
    if (!inputValue.trim()) return;

    const value = inputValue.trim();
    setInputValue("");
    setActiveAttr(null);
    setError(null);

    updateNodes(prev => updateTree(prev, node.id, item => {
      const existing = item.attributes.find(a => a.name === attr);
      if (!existing) {
        return { ...item, attributes: [...item.attributes, { name: attr, value }] };
      }

      return {
        ...item,
        attributes: item.attributes.map(a =>
          a.name === attr
            ? { ...a, value: addValue(a.value, value, ATTRIBUTE_LIMITS[attr] ?? null) }
            : a
        )
      };
    }));
  };

  const deleteAttribute = (attr: string) => {
    updateNodes(prev => updateTree(prev, node.id, item => ({
      ...item,
      attributes: item.attributes.filter(a => a.name !== attr)
    })));
  };

  const deleteValue = (attr: string, val: string) => {
    updateAttr(attr, v => splitValues(v).filter(x => x !== val).join(" "));
  };

  const saveEdit = (attr: string, oldVal: string, newVal: string) => {
    if (!newVal || newVal === oldVal) return;

    updateAttr(attr, v => splitValues(v).map(x => x === oldVal ? newVal : x).join(" "));
    setEditing(null);
  };

  const openStyle = (attr: string, val: string) => {
    if (attr === "id") openStyleEditor(`#${val}`);
    if (attr === "class") openStyleEditor(`.${val}`);
    if (attr === "style") openStyleEditor(`[style]`);
  };

  const theme = isDark
    ? "bg-zinc-800 border-zinc-700 text-white"
    : "bg-gray-100 border-gray-300 text-black";

  return (
    <div className={`flex flex-col gap-3 text-sm ${isDark ? "text-white" : "text-black"}`}>
      {error && <div className="text-red-500 text-xs">{error}</div>}

      {node.data.attributes.map(attr => (
        <div key={attr.name} className={`p-2 rounded border ${theme}`}>
          <strong>{attr.name}</strong>

          <div className="flex flex-wrap gap-1 mt-1">
            {splitValues(attr.value).map(val => (
              <span key={val} className="px-2 py-1 rounded bg-gray-500/30 flex gap-1 items-center">
                {editing?.attr === attr.name && editing.val === val ? (
                  <input
                    value={editing.val}
                    onChange={e => setEditing({ attr: attr.name, val: e.target.value })}
                    onBlur={() => saveEdit(attr.name, val, editing.val)}
                    className="text-black text-xs"
                    autoFocus
                  />
                ) : (
                  <>
                    {val}
                    <Pencil size={12} onClick={() => setEditing({ attr: attr.name, val })} />
                  </>
                )}

                <Trash2 size={12} onClick={() => deleteValue(attr.name, val)} />

                {STYLEABLE_ATTRS.includes(attr.name) && (
                  <Palette size={12} onClick={() => openStyle(attr.name, val)} />
                )}
              </span>
            ))}
          </div>

          <div className="flex gap-2 mt-2">
            <button onClick={() => setActiveAttr(attr.name)}><Plus size={14} /></button>
            <button onClick={() => deleteAttribute(attr.name)}><Trash2 size={14} /></button>
          </div>

          {activeAttr === attr.name && (
            <div className="flex gap-2 mt-1">
              <input
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                className="text-black text-xs px-1"
              />
              <button onClick={() => addAttribute(attr.name)}>OK</button>
            </div>
          )}
        </div>
      ))}

      <div className={`p-2 border rounded ${theme}`}>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filtrovat..."
          className="w-full px-2 py-1 text-black"
        />

        <div className="max-h-40 overflow-auto mt-2">
          {filteredAttributes.map(attr => (
            <div key={attr} onClick={() => setActiveAttr(attr)} className="cursor-pointer hover:underline">
              {attr}
            </div>
          ))}
        </div>

        {activeAttr && !node.data.attributes.some(a => a.name === activeAttr) && (
          <div className="mt-2 flex gap-2">
            <input
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              className="text-black px-2 py-1"
            />
            <button onClick={() => addAttribute(activeAttr)}>Přidat</button>
          </div>
        )}
      </div>
    </div>
  );
}
