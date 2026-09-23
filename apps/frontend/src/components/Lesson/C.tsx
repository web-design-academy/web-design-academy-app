import { useEffect, useMemo, useState } from "react";
import * as monaco from "monaco-editor";
import { useTheme } from "@/lib/ctx/useTheme";

interface Props {
  l: "css" | "html" | "js" | "javascript";
  children: string;
}

export default function C({ l, children }: Props) {
  const { theme } = useTheme();
  const [highlightedHtml, setHighlightedHtml] = useState<string>("");

  const lang = useMemo(() => (l === "js" ? "javascript" : l), [l]);
  const monacoTheme = theme === "dark" ? "vs-dark" : "vs-light";

  useEffect(() => {
    let cancelled = false;

    monaco.editor.setTheme(monacoTheme);
    monaco.editor
      .colorize(children, lang, {})
      .then((html) => {
        if (!cancelled) {
          setHighlightedHtml(
            html.replace(/\r?\n/g, "").replace(/<br\s*\/?>/gi, ""),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHighlightedHtml("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [children, lang, monacoTheme]);

  if (!highlightedHtml) {
    return (
      <code className={`monaco-inline-code lang-${lang}`}>{children}</code>
    );
  }

  return (
    <code
      className={`monaco-inline-code lang-${lang}`}
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
    />
  );
}
