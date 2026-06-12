/**
 * ------------------------------------------------------------
 * File: NodeStyleEditor.tsx
 * Description: 
 * Author: Karolína Virágová, xvirag00
 * Created: 2026-03-10
 * ------------------------------------------------------------
 */


// =========================
// NodeStyleEditor (Refactored, unified, isDark)
// =========================
import knownCssProperties from "known-css-properties";
import { useState, useEffect, useMemo } from "react";
import { Trash2 } from "lucide-react";

interface StyleProps {
  selector: string;
  cssContent: string;
  setCssContent: React.Dispatch<React.SetStateAction<string>>;
  isDark: boolean;
}

const SIZE_PROPERTIES = [
  "width","height","min-width","max-width","min-height","max-height",
  "margin","margin-top","margin-right","margin-bottom","margin-left",
  "padding","padding-top","padding-right","padding-bottom","padding-left",
  "top","left","right","bottom","font-size","border-radius"
];

const UNITS = ["px","%","vh","vw","rem","em"];

const ALL_PROPS = knownCssProperties.all.filter(p => !p.startsWith("-"));

const isColor = (p: string) =>
  p.includes("color") || (p.startsWith("border-") && p.endsWith("color")) || p === "background";

const splitNumeric = (v: string) => {
  const m = v.match(/^(-?\d*\.?\d+)([a-z%]*)$/i);
  return m ? { num: m[1], unit: m[2] || "px" } : { num: "", unit: "px" };
};

export default function NodeStyleEditor({ selector, cssContent, setCssContent, isDark }: StyleProps) {
  const [rules, setRules] = useState<Record<string,string>>({});
  const [filter, setFilter] = useState("");
  const [activeProp, setActiveProp] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");

  const COLOR_PROPS = useMemo(() => ALL_PROPS.filter(isColor), []);

  useEffect(() => {
    const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`${esc}\\s*\\{([^}]*)\\}`).exec(cssContent);

    const parsed: Record<string,string> = {};
    match?.[1]?.split(";").forEach(line => {
      const [k,v] = line.split(":").map(s => s?.trim());
      if (k && v && !k.startsWith("-")) parsed[k] = v;
    });

    setRules(parsed);
  }, [cssContent, selector]);

  const updateCss = (newRules: Record<string,string>) => {
    const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`${esc}\\s*\\{[^}]*\\}`);

    const body = Object.entries(newRules)
      .map(([k,v]) => `  ${k}: ${v};`).join("\n");

    let updated = cssContent;

    if (body) {
      const block = `${selector} {\n${body}\n}`;
      updated = regex.test(cssContent)
        ? cssContent.replace(regex, block)
        : cssContent + `\n\n${block}`;
    } else {
      updated = cssContent.replace(regex, "").trim();
    }

    setCssContent(updated);
    setRules(newRules);
  };

  const setProp = (prop: string, val: string) => updateCss({ ...rules, [prop]: val });

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

  const renderInput = (prop: string, value: string, onChange: (v:string)=>void) => {
    if (COLOR_PROPS.includes(prop)) {
      return (
        <div className="flex items-center gap-1.5 ml-1.5">
          <input type="color" value={value.startsWith("#")?value:"#000000"} onChange={e=>onChange(e.target.value)} />
          <input value={value} onChange={e=>onChange(e.target.value)} className="px-1.5 py-1 text-black rounded" />
        </div>
      );
    }

    if (SIZE_PROPERTIES.includes(prop)) {
      const { num, unit } = splitNumeric(value);
      return (
        <div className="flex items-center gap-1.5 ml-1.5">
          <input type="number" value={num} onChange={e=>onChange(e.target.value + unit)} className="w-20 px-1.5 py-1 text-black rounded" />
          <select value={unit} onChange={e=>onChange(num + e.target.value)} className="px-1.5 py-1 rounded">
            {UNITS.map(u => (<option key={u} value={u}>{u}</option>))}
          </select>
        </div>
      );
    }

    return (
      <input value={value} onChange={e=>onChange(e.target.value)} className="ml-1.5 px-1.5 py-1 text-black rounded" />
    );
  };

  const theme = isDark
    ? "bg-zinc-800 border-zinc-700 text-white"
    : "bg-gray-100 border-gray-300 text-black";

  return (
    <div className={`flex flex-col gap-3 text-sm ${isDark ? "text-white" : "text-black"}`} onClick={(e)=>e.stopPropagation()}>
      <p className="text-xs mb-1.5">Stylování pro <b>{selector}</b></p>

      {Object.entries(rules).map(([prop, value]) => (
        <div key={prop} className={`flex items-center gap-2 p-2 rounded border ${theme}`}>
          <label className="flex-1 text-sm">
            {prop}:
            {renderInput(prop, value, (v)=>setProp(prop, v))}
          </label>
          <button onClick={()=>removeProp(prop)} className="px-2 py-1 bg-red-600 rounded">
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      {activeProp && (
        <div className={`p-2 rounded border ${theme}`}>
          <p className="mb-1 text-sm">Nastavit hodnotu pro <b>{activeProp}</b></p>
          {renderInput(activeProp, inputValue, setInputValue)}
          <div className="flex gap-2 mt-2">
            <button onClick={confirmAdd} className="px-3 py-1 bg-green-600 rounded">Přidat</button>
            <button onClick={cancelAdd} className="px-3 py-1 bg-gray-500 rounded">Zrušit</button>
          </div>
        </div>
      )}

      <div className={`border rounded overflow-hidden ${theme}`}>
        <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filtrovat vlastnosti…" className="w-full px-3 py-2 text-black" />
        <div className="max-h-56 overflow-y-auto">
          {ALL_PROPS
            .filter(p => !(p in rules))
            .filter(p => p.toLowerCase().includes(filter.toLowerCase()))
            .map(p => (
              <div key={p} onClick={()=>startAdd(p)} className="px-3 py-2 cursor-pointer hover:underline">
                {p}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

