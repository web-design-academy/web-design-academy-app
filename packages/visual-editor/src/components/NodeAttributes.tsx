/**
 * ------------------------------------------------------------
 * File: NodeAttributes.tsx
 * Description: Attribute management
 * Author: Karolína Virágová, xvirag00
 * Created: 2026-03-10
 * ------------------------------------------------------------
 */

import type { Item } from "../types.js";
import type { NodeApi } from "react-arborist";
import { useState, useMemo } from "react";
import tags from "../tags.json";
import { Plus, Trash2, Pencil, Palette } from "lucide-react";

type Props = {
  node: NodeApi<Item>;
  updateNodes: (updater: (prev: Item[]) => Item[]) => void;
  tagName: string;
  openStyleEditor: (selector: string) => void;
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
  disabled: 1,
};

const GLOBAL_ATTRIBUTES = [
  "id",
  "class",
  "style",
  "title",
  "lang",
  "dir",
  "hidden",
  "tabindex",
  "contenteditable",
  "draggable",
  "spellcheck",
];

const STYLEABLE_ATTRS = ["id", "class", "style"];

export default function NodeAttributes({
  node,
  updateNodes,
  tagName,
  openStyleEditor,
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
    (tags as any[]).find((t) => t.name === tag)?.attributes ?? [];

  const validAttributes = useMemo(
    () =>
      Array.from(
        new Set([
          ...GLOBAL_ATTRIBUTES,
          ...getTagAttributes(tagName).map((a: any) => a.name),
        ]),
      ),
    [tagName],
  );

  const filteredAttributes = validAttributes.filter(
    (a) =>
      a.toLowerCase().includes(filter.toLowerCase()) &&
      !node.data.attributes.some((attr) => attr.name === a),
  );

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const updateTree = (
    items: Item[],
    id: string,
    updater: (i: Item) => Item,
  ): Item[] =>
    items.map((item) =>
      item.id === id
        ? updater(item)
        : {
            ...item,
            children: item.children?.length
              ? updateTree(item.children, id, updater)
              : item.children,
          },
    );

  const splitValues = (val: string) => val.split(/\s+/).filter(Boolean);

  const updateAttr = (attr: string, fn: (val: string) => string) => {
    updateNodes((prev) =>
      updateTree(prev, node.id, (item) => ({
        ...item,
        attributes: item.attributes.map((a) =>
          a.name === attr ? { ...a, value: fn(a.value) } : a,
        ),
      })),
    );
  };

  const addAttribute = (attr: string) => {
    if (!inputValue.trim()) return;

    const value = inputValue.trim();

    setInputValue("");
    setActiveAttr(null);

    updateNodes((prev) =>
      updateTree(prev, node.id, (item) => {
        const existing = item.attributes.find((a) => a.name === attr);

        if (!existing) {
          return {
            ...item,
            attributes: [...item.attributes, { name: attr, value }],
          };
        }

        return {
          ...item,
          attributes: item.attributes.map((a) =>
            a.name === attr
              ? {
                  ...a,
                  value: splitValues(a.value).includes(value)
                    ? a.value
                    : [...splitValues(a.value), value].join(" "),
                }
              : a,
          ),
        };
      }),
    );
  };

  const deleteAttribute = (attr: string) => {
    updateNodes((prev) =>
      updateTree(prev, node.id, (item) => ({
        ...item,
        attributes: item.attributes.filter((a) => a.name !== attr),
      })),
    );
  };

  const deleteValue = (attr: string, val: string) => {
    updateAttr(attr, (v) =>
      splitValues(v)
        .filter((x) => x !== val)
        .join(" "),
    );
  };

  const saveEdit = (attr: string, oldVal: string, newVal: string) => {
    if (!newVal || newVal === oldVal) return;

    const limit = ATTRIBUTE_LIMITS[attr] ?? null;

    updateAttr(attr, (v) => {
      const values = splitValues(v);

      if (limit === 1) {
        return newVal;
      }

      return values.map((x) => (x === oldVal ? newVal : x)).join(" ");
    });

    setEditing(null);
  };

  const openStyle = (attr: string, val: string) => {
    if (attr === "id") openStyleEditor(`#${val}`);
    if (attr === "class") openStyleEditor(`.${val}`);
    if (attr === "style") openStyleEditor(`[style]`);
  };

  return (
    <div className="ve-form" onClick={stop}>
      {node.data.attributes.map((attr) => (
        <div key={attr.name} className="ve-form-card wda-card">
          <strong>{attr.name}</strong>

          <div className="ve-chip-list" onClick={stop}>
            {splitValues(attr.value).map((val) => (
              <span key={val} className="ve-chip">
                {editing?.attr === attr.name && editing.original === val ? (
                  <input
                    value={editing.val}
                    onChange={(e) =>
                      setEditing({
                        attr: attr.name,
                        val: e.target.value,
                        original: editing.original,
                      })
                    }
                    onClick={stop}
                    onBlur={(e) => saveEdit(attr.name, val, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        saveEdit(
                          attr.name,
                          val,
                          (e.target as HTMLInputElement).value,
                        );
                      }
                    }}
                    className="wda-input ve-input is-compact"
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
                          original: val,
                        });
                        stop(e);
                      }}
                      className="ve-inline-action"
                    />
                  </>
                )}

                <Trash2
                  size={16}
                  onClick={(e) => {
                    stop(e);
                    deleteValue(attr.name, val);
                  }}
                  className="ve-inline-action is-danger"
                />

                {STYLEABLE_ATTRS.includes(attr.name) && (
                  <Palette
                    size={16}
                    onClick={(e) => {
                      stop(e);
                      openStyle(attr.name, val);
                    }}
                    className="ve-inline-action is-accent"
                  />
                )}
              </span>
            ))}
          </div>

          <div className="ve-form-actions">
            <button
              className="wda-icon-button ve-icon-button"
              onClick={() => setActiveAttr(attr.name)}
            >
              <Plus size={16} />
            </button>
            <button
              className="wda-icon-button ve-icon-button is-danger"
              onClick={() => deleteAttribute(attr.name)}
            >
              <Trash2 size={16} />
            </button>
          </div>

          {activeAttr === attr.name && (
            <div className="ve-inline-form">
              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="wda-input ve-input"
                onClick={stop}
              />
              <button
                className="wda-button ve-button is-primary"
                onClick={() => addAttribute(attr.name)}
              >
                OK
              </button>
            </div>
          )}
        </div>
      ))}

      <div className="ve-form-card wda-card">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search attributes"
          className="wda-input ve-input ve-search-input"
          onClick={stop}
        />

        <div className="ve-option-list is-compact">
          {filteredAttributes.map((attr) => (
            <div
              key={attr}
              onClick={(e) => {
                stop(e);
                setActiveAttr(attr);
              }}
              className="ve-list-option"
            >
              {attr}
            </div>
          ))}
        </div>

        {activeAttr &&
          !node.data.attributes.some((a) => a.name === activeAttr) && (
            <div className="ve-inline-form">
              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onClick={stop}
                className="wda-input ve-input"
              />
              <button
                className="wda-button ve-button is-primary"
                onClick={() => addAttribute(activeAttr)}
              >
                Add
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
