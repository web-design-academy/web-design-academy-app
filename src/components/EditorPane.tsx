import { useEffect, useState } from "react";
import MonacoEditor from "@monaco-editor/react";

import LoadingSpinner from "@/components/LoadingSpinner";

interface EditorPaneProps {
  value: string;
  onChange: (value: string) => void;
}

export default function EditorPane({ value, onChange }: EditorPaneProps) {
  const [theme, setTheme] = useState<"vs-dark" | "light">(
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "vs-dark"
      : "light",
  );

  useEffect(() => {
    const stored = localStorage.getItem("preferred-theme");
    setTheme(stored === "dark" ? "vs-dark" : "light");

    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      setTheme(currentTheme === "dark" ? "vs-dark" : "light");
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <MonacoEditor
      loading={<LoadingSpinner />}
      height="100%"
      defaultLanguage="html"
      theme={theme}
      value={value}
      onChange={(newValue) => onChange(newValue ?? "")}
      options={{
        minimap: { enabled: false },
        lineNumbersMinChars: 3,
        scrollbar: { vertical: "auto", horizontal: "auto" },
        overviewRulerLanes: 0,
        overviewRulerBorder: false,
        glyphMargin: false,
        contextmenu: false,
        fontSize: 14,
        wordWrap: "on",
        cursorStyle: "line",
        cursorBlinking: "blink",
      }}
    />
  );
}
