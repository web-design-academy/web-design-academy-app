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
  solutionHtml?: string;
  solutionCss?: string;
  solutionJs?: string;
}

const allModules = import.meta.glob<string>(
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

    const content = allModules[path] as string;
    const match = path.match(
      /tasks[\\/](\d+)[\\/](editable|hidden|readonly|solution)\.(html|css|js)$/,
    );
    if (!match) continue;

    const [, taskId, fileName, ext] = match;
    if (!tasksMap[taskId]) tasksMap[taskId] = {};

    if (fileName === "editable" && ext === "html")
      tasksMap[taskId].editableHtml = content;
    else if (fileName === "editable" && ext === "css")
      tasksMap[taskId].editableCss = content;
    else if (fileName === "editable" && ext === "js")
      tasksMap[taskId].editableJs = content;
    else if (fileName === "readonly" && ext === "html")
      tasksMap[taskId].readonlyHtml = content;
    else if (fileName === "readonly" && ext === "css")
      tasksMap[taskId].readonlyCss = content;
    else if (fileName === "readonly" && ext === "js")
      tasksMap[taskId].readonlyJs = content;
    else if (fileName === "hidden" && ext === "html")
      tasksMap[taskId].hiddenHtml = content;
    else if (fileName === "hidden" && ext === "css")
      tasksMap[taskId].hiddenCss = content;
    else if (fileName === "hidden" && ext === "js")
      tasksMap[taskId].hiddenJs = content;
    else if (fileName === "solution" && ext === "html")
      tasksMap[taskId].solutionHtml = content;
    else if (fileName === "solution" && ext === "css")
      tasksMap[taskId].solutionCss = content;
    else if (fileName === "solution" && ext === "js")
      tasksMap[taskId].solutionJs = content;
  }

  const fileTasks = Object.keys(tasksMap)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map((id) => tasksMap[id]);

  const customTasks = getCustomTasks(lessonSlug);

  if (customTasks.length > 0) {
    return customTasks.map((customTask, index) => ({
      ...fileTasks[index],
      ...customTask,
    }));
  }

  return fileTasks;
}
