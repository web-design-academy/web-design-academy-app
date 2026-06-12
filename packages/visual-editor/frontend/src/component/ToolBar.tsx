import { useTranslation } from "react-i18next";
import { useState, useRef } from "react";
import {Menu } from "lucide-react";
interface Props {
  dark: boolean;
  setDark: (v: boolean) => void;
  setPreviewWidth: (v: number | "full") => void;
  mobileView: "editor" | "preview";
  setMobileView: (v: "editor" | "preview") => void;
  scenarios: { name: string }[];
  currentScenarioName: string | null;
  onSelectScenario: (name: string) => void;

  onDownloadZip: () => void;
  onImportFiles: (files: FileList | null) => void; 
  
}

export default function Toolbar({
  dark,
  setDark,
  setPreviewWidth,
  mobileView,
  setMobileView,
  scenarios,
  currentScenarioName,
  onSelectScenario,
  onDownloadZip,
  onImportFiles,
}: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <div className="p-2 border-b relative z-50">

      {/* MOBILE HEADER */}
      <div className="flex justify-between sm:hidden">
        <span className="font-semibold">Menu</span>
        <button
          onClick={() => setOpen(!open)}
          className="px-2 py-1 bg-mauve-600 text-white rounded"
        >
          <Menu />
        </button>
      </div>

      {/* MOBILE MENU */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-10 bg-black/30 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setOpen(false)}
          />

          <div
            ref={menuRef}
            className="absolute top-12 left-2 right-2 z-20 flex flex-col gap-2 p-4 bg-mauve-600 rounded shadow-md
                       transform transition-transform duration-300 animate-slide-down"
          >
            {/* SCENARIO */}
            <select
              value={currentScenarioName || ""}
              onChange={(e) => {
                onSelectScenario(e.target.value);
                setOpen(false);
              }}
              className="border px-2 py-1 text-white bg-mauve-700"
            >
              <option value="" disabled>Vyber scénář</option>
              {scenarios.map((s) => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>

            {/* MOBILE VIEW SWITCH */}
            <div className="flex gap-2">
              <button
                className={`px-2 py-1 ${mobileView === "editor" ? "bg-mauve-800" : "bg-mauve-700"} text-white rounded`}
                onClick={() => {
                  setMobileView("editor");
                  setOpen(false);
                }}
              >
                Editor
              </button>

              <button
                className={`px-2 py-1 ${mobileView === "preview" ? "bg-mauve-800" : "bg-mauve-700"} text-white rounded`}
                onClick={() => {
                  setMobileView("preview");
                  setOpen(false);
                }}
              >
                Preview
              </button>
            </div>

            {/* IMPORT */}
            <label className="px-2 py-1 bg-mauve-700 text-white rounded text-center cursor-pointer">
              Import HTML/CSS
              <input
                type="file"
                accept=".html,.css"
                multiple
                onChange={(e) => {
                  onImportFiles(e.target.files);
                  setOpen(false);
                }}
                className="hidden"
              />
            </label>

            {/* EXPORT ZIP */}
            <button
              onClick={() => {
                onDownloadZip();
                setOpen(false);
              }}
              className="px-2 py-1 bg-mauve-700 text-white rounded"
            >
              Export ZIP
            </button>

            {/* DARK MODE */}
            <button
              onClick={() => {
                setDark(!dark);
                setOpen(false);
              }}
              className="px-2 py-1 bg-mauve-700 text-white rounded"
            >
              {t("darkMode")}
            </button>

            {/* LANGUAGE */}
            <select
              value={i18n.language}
              onChange={(e) => {
                i18n.changeLanguage(e.target.value);
                setOpen(false);
              }}
              className="border px-2 py-1 text-white bg-mauve-700"
            >
              <option value="cs">Čeština</option>
              <option value="en">English</option>
            </select>

            {/* WIDTH */}
            <input
              type="number"
              placeholder="šířka px"
              onChange={(e) => setPreviewWidth(Number(e.target.value))}
              className="border px-2 text-white bg-mauve-700"
            />

            <button
              onClick={() => {
                setPreviewWidth("full");
                setOpen(false);
              }}
              className="bg-mauve-700 text-white px-2 py-1"
            >
              Default
            </button>
          </div>
        </>
      )}

      {/* DESKTOP */}
      <div className="hidden sm:flex justify-between">
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setDark(!dark)}
            className="px-2 py-1 bg-mauve-600 text-white rounded"
          >
            {t("darkMode")}
          </button>

          {/* SCENARIO */}
          <select
            value={currentScenarioName || ""}
            onChange={(e) => onSelectScenario(e.target.value)}
            className="border px-2 py-1 text-white bg-mauve-600"
          >
            <option value="" disabled>Vyber scénář</option>
            {scenarios.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>

          {/* LANGUAGE */}
          <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="border px-2 py-1 bg-mauve-600 text-white"
          >
            <option value="cs">Čeština</option>
            <option value="en">English</option>
          </select>

          {/* IMPORT */}
            <label className="px-2 py-1 bg-mauve-700 text-white rounded text-center cursor-pointer">
              Import HTML/CSS
              <input
                type="file"
                accept=".html,.css"
                multiple
                onChange={(e) => {
                  onImportFiles(e.target.files);
                  setOpen(false);
                }}
                className="hidden"
              />
            </label>
            
          {/* EXPORT */}
          <button
            onClick={onDownloadZip}
            className="bg-mauve-600 text-white px-2 py-1"
          >
            Export ZIP
          </button>
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="number"
            placeholder="šířka px"
            onChange={(e) => setPreviewWidth(Number(e.target.value))}
            className="w-20 text-white"
          />

          <button
            onClick={() => setPreviewWidth("full")}
            className="bg-mauve-600 text-white px-2"
          >
            Default
          </button>
        </div>
      </div>
    </div>
  );
}