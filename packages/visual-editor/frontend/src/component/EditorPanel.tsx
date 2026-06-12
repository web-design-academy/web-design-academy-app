/**
 * ------------------------------------------------------------
 * File: EditorPanel.tsx
 * Description: Panel connecting the Monaco editor with the visual editor
 * Author: Karolína Virágová, xvirag00
 * Created: 2026-03-10
 * ------------------------------------------------------------
 */

import Editor from "@monaco-editor/react";
import  VisualEditor  from "../VisualEditor/VisualEditor";
import { useState } from "react";

type Task = {
  editableHtml?: string;
  editableCss?: string;
};

type Props = {
  task: Task;
  onTaskChange: (field: "editableHtml" | "editableCss", value: string) => void;
  dark: boolean;
};

export default function EditorPanel({
  task,
  onTaskChange,
  dark
}: Props) {

  {/*Setting editor, default visual editor*/}
  const [editorMode, setEditorMode] = useState<"monaco" | "visual">("visual");

  {/*Setting monaco editor like HTML or CSS, default HTML */}
  const [tab, setTab] = useState<"html" | "css">("html");

  return (
    <div className="h-full flex flex-col">

      {/* MOBILE TOOLBAR */}
      <div className="flex sm:hidden gap-2 p-2 bg-mauve-600 text-white">
        <select
          value={editorMode}
          onChange={(e) =>
            setEditorMode(e.target.value as "monaco" | "visual")
          }
          className="text-black px-2"
        >
          <option value="monaco">Monaco</option>
          <option value="visual">Visual</option>
        </select>
        {editorMode === "monaco" && (
          <select
            value={tab}
            onChange={(e) =>
              setTab(e.target.value as "html" | "css")
            }
            className="text-black px-2"
          >
            <option value="html">HTML</option>
            <option value="css">CSS</option>
          </select>
        )}

      </div>

      {/* DESKTOP TOOLBAR */}
      <div className="hidden sm:flex gap-2 p-2 bg-mauve-600 text-white">
        <button onClick={() => setEditorMode("monaco")}>
          Monaco
        </button>
        <button onClick={() => setEditorMode("visual")}>
          Visual
        </button>
        {editorMode === "monaco" && (
          <>
            <button onClick={() => setTab("html")}>HTML</button>
            <button onClick={() => setTab("css")}>CSS</button>
          </>
        )}
      </div>

      <div className="flex-1 ">
        {/*If setting monaco view monaco editor, else visual editor*/}
        {editorMode === "monaco" ? (
          <Editor
            height="100%"
            language={tab}
            value={
              tab === "html"
                ? task.editableHtml || ""
                : task.editableCss || ""
            }
            theme={dark ? "vs-dark" : "vs"}
            options={{
              minimap: { enabled: false },
              fontSize: 14
            }}
            onChange={(v) => {
              const value = v ?? "";
              if (tab === "html") {
                onTaskChange("editableHtml", value);
              } else {
                onTaskChange("editableCss", value);
              }
            }}
          />
        ) : (
          <VisualEditor
            content={task.editableHtml || ""}
            setContent={(val: any) => {
              const newVal =
                typeof val === "function"
                  ? val(task.editableHtml || "")
                  : val;

              onTaskChange("editableHtml", newVal);
            }}
            cssContent={task.editableCss || ""}
            setCssContent={(val: any) => {
              const newVal =
                typeof val === "function"
                  ? val(task.editableCss || "")
                  : val;
              onTaskChange("editableCss", newVal);
            }}
            isDark={dark}
          />

        )}
      </div>
    </div>
  );
}