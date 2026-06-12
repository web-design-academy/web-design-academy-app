/**
 * ------------------------------------------------------------
 * File: App.tsx
 * Description: Main points of program
 * Author: Karolína Virágová, xvirag00
 * Created: 2026-03-10
 * ------------------------------------------------------------
 */

import { useState, useEffect } from "react";
import Toolbar from "./component/ToolBar";
import EditorPanel from "./component/EditorPanel";
import PreviewFrame from "./component/PreviewFrame";
import ScenarioPanel from "./component/ScenarioPanel";
import "./i18n";

import { useScenarios } from "./scenario/useScenarios";

import JSZip from "jszip";
import { saveAs } from "file-saver";

export default function App() {
  const [dark, setDark] = useState(true);
  const [previewWidth, setPreviewWidth] = useState<number | "full">("full");
  const [mobileView, setMobileView] = useState<"editor" | "preview">("editor");

  const {
    scenarios,
    currentScenario,
    taskIndex,
    openScenario,
    setOpenScenario,
    selectScenario,
    next,
    prev,
  } = useScenarios();

  type EditableTask = {
    editableHtml: string;
    editableCss: string;
  };

  const [task, setTask] = useState<EditableTask>({
    editableHtml: "",
    editableCss: "",
  });

  // 🔥 uložená práce uživatele (PŘED otevřením scénáře)
  const [userDraft, setUserDraft] = useState<EditableTask | null>(null);

  // 🔥 načtení tasku ze scénáře
  useEffect(() => {
    if (currentScenario?.tasks?.[taskIndex]) {
      const t = currentScenario.tasks[taskIndex];

      setTask({
        editableHtml: t.html || "",
        editableCss: t.css || "",
      });
    }
  }, [currentScenario, taskIndex]);

  // 🔥 uloží draft před otevřením scénáře
  const handleSelectScenario = (name: string) => {
    setUserDraft(task); // uloží tvoji práci
    selectScenario(name);
  };

  // ❌ už NEresetujeme na scénář
  const handleCloseScenario = () => {
    setOpenScenario(false);

    // 🔥 vrátí tvoji původní práci
    if (userDraft) {
      setTask(userDraft);
    }
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();

    const htmlContent = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <title>${currentScenario?.name || "Export"}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
${task.editableHtml}
</body>
</html>`;

    zip.file("index.html", htmlContent);
    zip.file("styles.css", task.editableCss);

    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${currentScenario?.name || "export"}.zip`);
  };

  const handleImportFiles = (files: FileList | null) => {
    if (!files) return;

    let html = "";
    let css = "";

    const readers: Promise<void>[] = [];

    Array.from(files).forEach((file) => {
      const reader = new FileReader();

      const promise = new Promise<void>((resolve) => {
        reader.onload = (e) => {
          const content = e.target?.result as string;

          if (file.name.endsWith(".html")) html = content;
          if (file.name.endsWith(".css")) css = content;

          resolve();
        };
      });

      reader.readAsText(file);
      readers.push(promise);
    });

    Promise.all(readers).then(() => {
      setTask((prev) => ({
        editableHtml: html || prev.editableHtml,
        editableCss: css || prev.editableCss,
      }));
    });
  };

  return (
    <div
      className={
        dark
          ? "bg-black text-white h-screen flex flex-col"
          : "bg-white text-black h-screen flex flex-col"
      }
    >
      <Toolbar
        dark={dark}
        setDark={setDark}
        setPreviewWidth={setPreviewWidth}
        mobileView={mobileView}
        setMobileView={setMobileView}
        scenarios={scenarios}
        currentScenarioName={currentScenario?.name || null}
        onSelectScenario={handleSelectScenario}   // 🔥 změna
        onDownloadZip={handleDownloadZip}
        onImportFiles={handleImportFiles}
      />

      {/* Desktop */}
      <div className="hidden sm:grid sm:grid-cols-2 flex-1 overflow-hidden">
        <div className="overflow-auto">
          <EditorPanel
            task={task}
            onTaskChange={(field, value) =>
              setTask((prev) => ({ ...prev, [field]: value }))
            }
            dark={dark}
          />
        </div>

        <div className="h-full overflow-auto">
          <PreviewFrame
            htmlContent={task.editableHtml}
            cssContent={task.editableCss}
            previewWidth={previewWidth}
          />
        </div>
      </div>

      {/* Mobile */}
      <div className="sm:hidden flex-1 relative overflow-hidden">
        <div
          className={`absolute inset-0 ${
            mobileView === "editor"
              ? "opacity-100 z-10"
              : "opacity-0 z-0 pointer-events-none"
          }`}
        >
          <EditorPanel
            task={task}
            onTaskChange={(field, value) =>
              setTask((prev) => ({ ...prev, [field]: value }))
            }
            dark={dark}
          />
        </div>

        <div
          className={`absolute inset-0 ${
            mobileView === "preview"
              ? "opacity-100 z-10"
              : "opacity-0 z-0 pointer-events-none"
          }`}
        >
          <PreviewFrame
            htmlContent={task.editableHtml}
            cssContent={task.editableCss}
            previewWidth={previewWidth}
          />
        </div>
      </div>

      {/* ✅ PANEL */}
      {openScenario && currentScenario && (
        <ScenarioPanel
          openScenario={openScenario}
          currentScenario={currentScenario}
          taskIndex={taskIndex}
          next={next}
          prev={prev}
          setOpenScenario={handleCloseScenario} // 🔥 správně
        />
      )}
    </div>
  );
}