import Editor from "@monaco-editor/react";
import { useEffect, useState } from "react";

interface EditorPaneProps {
  value: string;
  onChange: (value: string) => void;
}

export default function EditorPane({ value, onChange }: EditorPaneProps) {
  const [theme, setTheme] = useState<"vs-dark" | "light">("light");

  useEffect(() => {
    const stored = localStorage.getItem("preferred-theme");
    if (stored === "dark") {
      setTheme("vs-dark");
    } else {
      setTheme("light");
    }

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
    <Editor
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
