/**
 * ------------------------------------------------------------
 * File: NodeStyleEditor.tsx
 * Description: CSS management
 * Author: Karolína Virágová, xvirag00
 * Created: 2026-03-10
 * ------------------------------------------------------------
 */

import knownCssProperties from "known-css-properties";
import { useState, useEffect, useMemo } from "react";
import { Trash2 } from "lucide-react";
import * as csstree from "css-tree";

interface StyleProps {
  selector: string;
  cssContent: string;
  setCssContent: (css: string) => void;
  canOverrideReadonly: boolean;
}

const SIZE_PROPERTIES = [
  "width",
  "height",
  "min-width",
  "max-width",
  "min-height",
  "max-height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "top",
  "left",
  "right",
  "bottom",
  "font-size",
  "border-radius",
];

const UNITS = ["px", "%", "vh", "vw", "rem", "em"];

const ALL_PROPS = knownCssProperties.all.filter((p) => !p.startsWith("-"));

const isColor = (p: string) =>
  p.includes("color") ||
  (p.startsWith("border-") && p.endsWith("color")) ||
  p === "background";

const splitNumeric = (v: string) => {
  const m = v.match(/^(-?\d*\.?\d+)([a-z%]*)$/i);
  return m ? { num: m[1], unit: m[2] || "px" } : { num: "", unit: "px" };
};

export default function NodeStyleEditor({
  selector,
  cssContent,
  setCssContent,
  canOverrideReadonly,
}: StyleProps) {
  const [rules, setRules] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const [activeProp, setActiveProp] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");

  const COLOR_PROPS = useMemo(() => ALL_PROPS.filter(isColor), []);

  useEffect(() => {
    const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`${esc}\\s*\\{([^}]*)\\}`).exec(cssContent);

    const parsed: Record<string, string> = {};
    match?.[1]?.split(";").forEach((line) => {
      const [k, v] = line.split(":").map((s) => s?.trim());
      if (k && v && !k.startsWith("-")) parsed[k] = v;
    });

    setRules(parsed);
  }, [cssContent, selector]);

  const updateCss = (newRules: Record<string, string>) => {
    let updated = cssContent;

    try {
      const ast = csstree.parse(cssContent, { positions: true });
      let matchedRule: any = null;
      csstree.walk(ast, {
        visit: "Rule",
        enter(node: any) {
          const selectors = csstree
            .generate(node.prelude)
            .split(",")
            .map((value: string) => value.trim());
          if (!matchedRule && selectors.includes(selector)) matchedRule = node;
        },
      });

      if (!matchedRule) {
        const body = Object.entries(newRules)
          .map(([property, value]) => `  ${property}: ${value};`)
          .join("\n");
        if (body)
          updated = `${cssContent.replace(/\s+$/, "")}\n\n${selector} {\n${body}\n}\n`;
      } else {
        if (!canOverrideReadonly && matchedRule.loc) {
          const beforeRule = cssContent.slice(0, matchedRule.loc.start.offset);
          const starts = (beforeRule.match(/\/\* readonly:start \*\//g) ?? [])
            .length;
          const ends = (beforeRule.match(/\/\* readonly:end \*\//g) ?? [])
            .length;
          if (starts > ends) return;
        }
        const declarations = new Map<string, any>();
        matchedRule.block.children.forEach((declaration: any) => {
          if (declaration.type === "Declaration") {
            declarations.set(declaration.property, declaration);
          }
        });
        const patches: { start: number; end: number; value: string }[] = [];

        Object.entries(rules).forEach(([property]) => {
          if (property in newRules) return;
          const declaration = declarations.get(property);
          if (declaration?.loc) {
            let end = declaration.loc.end.offset;
            if (cssContent[end] === ";") end += 1;
            patches.push({
              start: declaration.loc.start.offset,
              end,
              value: "",
            });
          }
        });

        Object.entries(newRules).forEach(([property, value]) => {
          const declaration = declarations.get(property);
          if (declaration?.value?.loc) {
            if (rules[property] !== value) {
              patches.push({
                start: declaration.value.loc.start.offset,
                end: declaration.value.loc.end.offset,
                value,
              });
            }
          } else {
            patches.push({
              start: matchedRule.block.loc.end.offset - 1,
              end: matchedRule.block.loc.end.offset - 1,
              value: `\n  ${property}: ${value};`,
            });
          }
        });

        patches
          .sort((left, right) => right.start - left.start)
          .forEach((patch) => {
            updated =
              updated.slice(0, patch.start) +
              patch.value +
              updated.slice(patch.end);
          });
      }
    } catch {
      return;
    }

    setCssContent(updated);
    setRules(newRules);
  };

  const setProp = (prop: string, val: string) =>
    updateCss({ ...rules, [prop]: val });

  const removeProp = (prop: string) => {
    const r = { ...rules };
    delete r[prop];
    updateCss(r);
  };

  const startAdd = (prop: string) => {
    setActiveProp(prop);
    setInputValue(COLOR_PROPS.includes(prop) ? "#000000" : "");
  };

  const confirmAdd = () => {
    if (!activeProp) return;
    updateCss({ ...rules, [activeProp]: inputValue });
    setActiveProp(null);
    setInputValue("");
    setFilter("");
  };

  const cancelAdd = () => {
    setActiveProp(null);
    setInputValue("");
  };

  const renderInput = (
    prop: string,
    value: string,
    onChange: (v: string) => void,
  ) => {
    if (COLOR_PROPS.includes(prop)) {
      return (
        <div className="ve-value-editor" onClick={(e) => e.stopPropagation()}>
          <input
            type="color"
            value={value.startsWith("#") ? value : "#000000"}
            onChange={(e) => onChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="wda-input ve-input"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      );
    }

    if (SIZE_PROPERTIES.includes(prop)) {
      const { num, unit } = splitNumeric(value);
      return (
        <div className="ve-value-editor" onClick={(e) => e.stopPropagation()}>
          <input
            type="number"
            value={num}
            onChange={(e) => onChange(e.target.value + unit)}
            className="wda-input ve-input is-number"
            onClick={(e) => e.stopPropagation()}
          />
          <select
            value={unit}
            onChange={(e) => onChange(num + e.target.value)}
            className="wda-input ve-input is-unit"
            onClick={(e) => e.stopPropagation()}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="wda-input ve-input ve-property-value"
        onClick={(e) => e.stopPropagation()}
      />
    );
  };

  return (
    <div className="ve-form" onClick={(e) => e.stopPropagation()}>
      <p className="ve-form-intro">
        Styling <b>{selector}</b>
      </p>

      {Object.entries(rules).map(([prop, value]) => (
        <div
          key={prop}
          className="ve-form-card ve-property-row wda-card"
          onClick={(e) => e.stopPropagation()}
        >
          <label
            className="ve-property-label"
            onClick={(e) => e.stopPropagation()}
          >
            {prop}:{renderInput(prop, value, (v) => setProp(prop, v))}
          </label>
          <button
            onClick={() => removeProp(prop)}
            className="wda-icon-button ve-icon-button is-danger"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}

      {activeProp && (
        <div className="ve-form-card wda-card">
          <p className="ve-form-intro">
            Set value for <b>{activeProp}</b>
          </p>
          {renderInput(activeProp, inputValue, setInputValue)}
          <div className="ve-form-actions">
            <button
              onClick={confirmAdd}
              className="wda-button ve-button is-primary"
            >
              Add
            </button>
            <button onClick={cancelAdd} className="wda-button ve-button">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="ve-form-card wda-card">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search CSS properties"
          className="wda-input ve-input ve-search-input"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="ve-option-list">
          {ALL_PROPS.filter((p) => !(p in rules))
            .filter((p) => p.toLowerCase().includes(filter.toLowerCase()))
            .map((p) => (
              <div
                key={p}
                onClick={() => startAdd(p)}
                className="ve-list-option"
              >
                {p}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
