import { getCustomTasks } from "./adminStorage";

export interface TaskCode {
  editableHtml: string;
  editableCss: string;
  editableJs: string;
  readonlyHtml: string;
  readonlyCss: string;
  readonlyJs: string;
  hiddenHtml: string;
  hiddenCss: string;
  hiddenJs: string;
}

const allModules = import.meta.glob<TaskCode>(
  "../../lessons/*/tasks/*/*.{html,css,js}",
  { query: "raw", import: "default", eager: true },
);

export function getLessonTasksSync(lessonSlug: string): Partial<TaskCode>[] {
  const tasksMap: Record<string, Partial<TaskCode>> = {};

  for (const path in allModules) {
    if (
      !path.includes(`/lessons/${lessonSlug}/tasks/`) &&
      !path.includes(`\\lessons\\${lessonSlug}\\tasks\\`)
    )
      continue;

    const content = allModules[path] as unknown as string;
    const match = path.match(
      /tasks[\\/](\d+)[\\/](editable|hidden|readonly)\.(html|css|js)$/,
    );
    if (!match) continue;

    const [, taskId, fileName, ext] = match;
    if (!tasksMap[taskId]) tasksMap[taskId] = {};

    const key = (() => {
      if (fileName === "editable" && ext === "html") return "editableHtml";
      if (fileName === "editable" && ext === "css") return "editableCss";
      if (fileName === "editable" && ext === "js") return "editableJs";
      if (fileName === "readonly" && ext === "html") return "readonlyHtml";
      if (fileName === "readonly" && ext === "css") return "readonlyCss";
      if (fileName === "readonly" && ext === "js") return "readonlyJs";
      if (fileName === "hidden" && ext === "html") return "hiddenHtml";
      if (fileName === "hidden" && ext === "css") return "hiddenCss";
      if (fileName === "hidden" && ext === "js") return "hiddenJs";
      return null;
    })();

    if (key) tasksMap[taskId][key] = content;
  }

  const fileTasks = Object.values(tasksMap);
  const customTasks = getCustomTasks(lessonSlug);

  if (customTasks.length > 0) {
    return customTasks.map((customTask, index) => ({
      ...fileTasks[index],
      ...customTask,
    }));
  }

  return fileTasks;
}
