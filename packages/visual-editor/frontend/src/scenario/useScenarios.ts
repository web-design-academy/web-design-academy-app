import { useState, useEffect } from "react";
import type { Lesson } from "./scenarioTypes";

const mdxModules = import.meta.glob("../lessons/*/index.mdx", {
  eager: true,
});

const htmlModules = import.meta.glob("../lessons/*/task/*/index.html", {
  eager: true,
  query: "?raw",
  import: "default",
});

const cssModules = import.meta.glob("../lessons/*/task/*/style.css", {
  eager: true,
  query: "?raw",
  import: "default",
});

export function useScenarios() {
  const [scenarios, setScenarios] = useState<Lesson[]>([]);
  const [currentScenario, setCurrentScenario] = useState<Lesson | null>(null);
  const [taskIndex, setTaskIndex] = useState(0);
  const [openScenario, setOpenScenario] = useState(false);

  useEffect(() => {
    const loaded: Lesson[] = [];

    for (const path in mdxModules) {
      const match = path.match(/lessons\/([^/]+)\//);
      if (!match) continue;

      const name = match[1];

      const tasks = Object.keys(htmlModules)
        .filter((p) => p.includes(`/lessons/${name}/task/`))
        .map((htmlPath, i) => {
          const cssPath = htmlPath.replace("index.html", "style.css");

          return {
            index: i,
            html: htmlModules[htmlPath] as string,
            css: cssModules[cssPath] as string,
          };
        });

      loaded.push({
        name,
        Explanation: (mdxModules[path] as any).default,
        tasks,
      });
    }

    setScenarios(loaded);
  }, []);

  const selectScenario = (name: string) => {
    const sc = scenarios.find((s) => s.name === name);
    if (!sc) return;

    setCurrentScenario(sc);
    setTaskIndex(0);
    setOpenScenario(true);
  };

  const next = () => {
    if (!currentScenario) return;
    setTaskIndex((p) => Math.min(p + 1, currentScenario.tasks.length - 1));
  };

  const prev = () => {
    setTaskIndex((p) => Math.max(p - 1, 0));
  };

  return {
    scenarios,
    currentScenario,
    taskIndex,
    openScenario,
    setOpenScenario,
    selectScenario,
    next,
    prev,
  };
}