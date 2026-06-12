/**
 * ------------------------------------------------------------
 * File: NodeAttributes.tsx
 * Description: Attribute management
 * Author: Karolína Virágová, xvirag00
 * Created: 2026-03-10
 * ------------------------------------------------------------
 */

import type { Item } from "../Types/Types.js";
import type { NodeApi } from "react-arborist";
import { useState, useMemo } from "react";
import tags from "../Node/tags.json";
import { Plus, Trash2, Pencil, Palette } from "lucide-react";

type Props = {
  node: NodeApi<Item>;
  updateNodes: (updater: (prev: Item[]) => Item[]) => void;
  tagName: string;
  cssContent: string;
  setCssContent: React.Dispatch<React.SetStateAction<string>>;
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

export default function NodeAttributes({
  node,
  updateNodes,
  tagName,
  openStyleEditor,
  isDark
}: Props) {

  const [editing, setEditing] = useState<{
    attr: string;
    val: string;
    original: string;
  } | null>(null);

  const [activeAttr, setActiveAttr] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [filter, setFilter] = useState("");

  const getTagAttributes = (tag: string) =>
    (tags as any[]).find(t => t.name === tag)?.attributes ?? [];

  const validAttributes = useMemo(() =>
    Array.from(new Set([
      ...GLOBAL_ATTRIBUTES,
      ...getTagAttributes(tagName).map((a: any) => a.name)
    ])),
    [tagName]
  );

  const filteredAttributes = validAttributes.filter(a =>
    a.toLowerCase().includes(filter.toLowerCase()) &&
    !node.data.attributes.some(attr => attr.name === a)
  );

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const updateTree = (items: Item[], id: string, updater: (i: Item) => Item): Item[] =>
    items.map(item =>
      item.id === id
        ? updater(item)
        : {
            ...item,
            children: item.children?.length
              ? updateTree(item.children, id, updater)
              : item.children
          }
    );

  const splitValues = (val: string) =>
    val.split(/\s+/).filter(Boolean);

  const updateAttr = (attr: string, fn: (val: string) => string) => {
    updateNodes(prev =>
      updateTree(prev, node.id, item => ({
        ...item,
        attributes: item.attributes.map(a =>
          a.name === attr ? { ...a, value: fn(a.value) } : a
        )
      }))
    );
  };

  const addAttribute = (attr: string) => {
    if (!inputValue.trim()) return;

    const value = inputValue.trim();

    setInputValue("");
    setActiveAttr(null);

    updateNodes(prev =>
      updateTree(prev, node.id, item => {
        const existing = item.attributes.find(a => a.name === attr);

        if (!existing) {
          return {
            ...item,
            attributes: [...item.attributes, { name: attr, value }]
          };
        }

        return {
          ...item,
          attributes: item.attributes.map(a =>
            a.name === attr
              ? {
                  ...a,
                  value: splitValues(a.value).includes(value)
                    ? a.value
                    : [...splitValues(a.value), value].join(" ")
                }
              : a
          )
        };
      })
    );
  };

  const deleteAttribute = (attr: string) => {
    updateNodes(prev =>
      updateTree(prev, node.id, item => ({
        ...item,
        attributes: item.attributes.filter(a => a.name !== attr)
      }))
    );
  };

  const deleteValue = (attr: string, val: string) => {
    updateAttr(attr, v =>
      splitValues(v).filter(x => x !== val).join(" ")
    );
  };

  const saveEdit = (attr: string, oldVal: string, newVal: string) => {
    if (!newVal || newVal === oldVal) return;

    const limit = ATTRIBUTE_LIMITS[attr] ?? null;

    updateAttr(attr, v => {
      const values = splitValues(v);

      if (limit === 1) {
        return newVal;
      }

      return values
        .map(x => (x === oldVal ? newVal : x))
        .join(" ");
    });

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
    <div
      className={`flex flex-col gap-3 text-sm ${isDark ? "text-white" : "text-black"}`}
      onClick={stop}
    >
      {node.data.attributes.map(attr => (
        <div key={attr.name} className={`p-2 rounded border ${theme}`}>
          <strong>{attr.name}</strong>

          <div className="flex flex-wrap gap-1 mt-1" onClick={stop}>
            {splitValues(attr.value).map(val => (
              <span
                key={val}
                className="px-2 py-1 rounded bg-gray-500/30 flex gap-1 items-center"
              >
                {editing?.attr === attr.name && editing.original === val ? (
                  <input
                    value={editing.val}
                    onChange={e =>
                      setEditing({
                        attr: attr.name,
                        val: e.target.value,
                        original: editing.original
                      })
                    }
                    onClick={stop}
                    onBlur={(e) =>
                      saveEdit(attr.name, val, e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        saveEdit(
                          attr.name,
                          val,
                          (e.target as HTMLInputElement).value
                        );
                      }
                    }}
                    className={`text-xs ${isDark ? "text-white" : "text-black"}`}
                  />
                ) : (
                  <>
                    {val}
                    <Pencil
                      size={16}
                      onClick={(e) => {
                        setEditing({
                          attr: attr.name,
                          val,
                          original: val
                        });
                        stop(e);
                      }}
                      className="hover:text-blue-900 transition"
                    />
                  </>
                )}

                <Trash2
                  size={16}
                  onClick={(e) => {
                    stop(e);
                    deleteValue(attr.name, val);
                  }}
                  className="hover:text-red-900 transition"
                />

                {STYLEABLE_ATTRS.includes(attr.name) && (
                  <Palette
                    size={16}
                    onClick={(e) => {
                      stop(e);
                      openStyle(attr.name, val);
                    }}
                    className="hover:text-green-900 transition"
                  />
                )}
              </span>
            ))}
          </div>

          <div className="flex gap-2 mt-2">
            <button onClick={() => setActiveAttr(attr.name)}>
              <Plus size={16} />
            </button>
            <button onClick={() => deleteAttribute(attr.name)}>
              <Trash2 size={16} />
            </button>
          </div>

          {activeAttr === attr.name && (
            <div className="flex gap-2 mt-1">
              <input
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                className={`p-1 text-sm border-2 border-white ${isDark ? "text-white" : "text-black"}`}
                onClick={stop}
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
          placeholder="Found attribute"
          className={`w-full p-2 border-2 border-white ${isDark ? "bg-zinc-800 text-white" : "bg-white text-black"}`}
          onClick={stop}
        />

        <div className="max-h-40 overflow-auto mt-2">
          {filteredAttributes.map(attr => (
            <div
              key={attr}
              onClick={(e) => {
                stop(e);
                setActiveAttr(attr);
              }}
              className={`${isDark ? "hover:bg-zinc-700" : "hover:bg-zinc-200"} px-2 py-1`}
            >
              {attr}
            </div>
          ))}
        </div>

        {activeAttr && !node.data.attributes.some(a => a.name === activeAttr) && (
          <div className="mt-2 flex gap-2">
            <input
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onClick={stop}
            />
            <button onClick={() => addAttribute(activeAttr)}>
              Přidat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}