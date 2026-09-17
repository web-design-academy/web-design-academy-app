import JSZip from "jszip";
import { ensureReadonlyBlockSpacing } from "./readonlyBlocks";
import {
  getLessonTasksAsync,
  type LessonMeta,
  type LessonTasks,
} from "@/lib/helpers/db.ts";
import type { TaskCode } from "@/lib/helpers/tasks.ts";

function addCourseToZip(
  zip: JSZip,
  course: LessonMeta,
  courseTasks: Partial<TaskCode>[],
): void {
  const courseFolder = zip.folder(course.id);
  if (!courseFolder) throw new Error("Failed to create zip folder");

  const jsonContent = JSON.stringify(
    course,
    (key, value) => (key === "tasks" ? undefined : value),
    2,
  );

  courseFolder.file(`${course.id}.json`, jsonContent);

  const tasksFolder = courseFolder.folder("tasks");
  if (!tasksFolder) throw new Error("Failed to create tasks folder");

  courseTasks
    .filter((task) => !task.deleted)
    .forEach((task, index) => {
      const taskId = (index + 1).toString();
      const taskFolder = tasksFolder.folder(taskId);
      if (!taskFolder) return;

      const addFile = (name: string, content?: string) => {
        if (content !== undefined && content.trim() !== "") {
          taskFolder.file(name, content);
        }
      };

      if (task.html !== undefined) {
        taskFolder.file(
          "index.html",
          ensureReadonlyBlockSpacing(task.html, "html"),
        );
      }
      if (task.css !== undefined) {
        taskFolder.file(
          "styles.css",
          ensureReadonlyBlockSpacing(task.css, "css"),
        );
      }
      if (task.js !== undefined) {
        taskFolder.file(
          "script.js",
          ensureReadonlyBlockSpacing(task.js, "js"),
        );
      }

      addFile("solution.html", task.solutionHtml);
      addFile("solution.css", task.solutionCss);
      addFile("solution.js", task.solutionJs);

      if (task.evaluation) {
        taskFolder.file(
          "evaluation.json",
          `${JSON.stringify(task.evaluation, null, 2)}\n`,
        );
      }
    });
}

async function downloadZip(zip: JSZip, suggestedName: string): Promise<void> {
  const blob = await zip.generateAsync({ type: "blob" });

  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (window as unknown as {
        showSaveFilePicker: (options: unknown) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: "Zip Archive",
            accept: { "application/zip": [".zip"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      console.warn("SaveFilePicker failed, using fallback download link", error);
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function generateCoursesZipAsync(
  courses: LessonMeta[],
  suggestedName: string = "lessons.zip",
): Promise<void> {
  const zip = new JSZip();
  for (const course of courses) {
    addCourseToZip(zip, course, await getLessonTasksAsync(course.id));
  }

  await downloadZip(zip, suggestedName);
}

export async function parseLessonZip(
  file: File,
): Promise<[LessonMeta[], LessonTasks[]]> {
  const zip = await JSZip.loadAsync(file);
  const lessonsMap = new Map<
    string,
    { meta: Partial<LessonMeta>; tasksMap: Map<number, Partial<TaskCode>> }
  >();

  for (const [path, fileEntry] of Object.entries(zip.files)) {
    if (fileEntry.dir) continue;
    if (path.startsWith("__MACOSX/") || path.includes("/.DS_Store")) continue;

    const splitPath = path.split("/");
    const rootFolder = splitPath[0];
    if (!rootFolder) continue;

    if (!lessonsMap.has(rootFolder)) {
      lessonsMap.set(rootFolder, { meta: {}, tasksMap: new Map() });
    }

    const currentLesson = lessonsMap.get(rootFolder)!;

    if (splitPath.length === 2 && splitPath[1] === `${rootFolder}.json`) {
      const meta = await fileEntry.async("text");
      try {
        const json = JSON.parse(meta) as Partial<LessonMeta>;
        currentLesson.meta = {
          ...currentLesson.meta,
          ...json,
        };
      } catch (err) {
        console.error(`Failed to parse metadata JSON for ${rootFolder}:`, err);
      }
    }
    else if (splitPath.length >= 4 && splitPath[1] === "tasks") {
      const taskId = parseInt(splitPath[2], 10);
      if (isNaN(taskId)) continue;

      if (!currentLesson.tasksMap.has(taskId)) {
        currentLesson.tasksMap.set(taskId, {});
      }

      const taskTarget = currentLesson.tasksMap.get(taskId)!;
      const fileContent = await fileEntry.async("text");
      const fileName = splitPath[3];

      switch (fileName) {
        case "index.html":
          taskTarget.html = fileContent;
          break;
        case "solution.html":
          taskTarget.solutionHtml = fileContent;
          break;
        case "styles.css":
          taskTarget.css = fileContent;
          break;
        case "solution.css":
          taskTarget.solutionCss = fileContent;
          break;
        case "script.js":
          taskTarget.js = fileContent;
          break;
        case "solution.js":
          taskTarget.solutionJs = fileContent;
          break;
        case "evaluation.json":
          try {
            taskTarget.evaluation = JSON.parse(fileContent);
          } catch (err) {
            console.error(`Failed to parse evaluation for task ${taskId}:`, err);
          }
          break;
        default:
          break;
      }
    }
  }

  const lessons: LessonMeta[] = [];
  const tasks: LessonTasks[] = [];

  lessonsMap.forEach((value, folderName) => {
    const lessonId = value.meta.id || folderName;

    const sortedTaskIds = Array.from(value.tasksMap.keys()).sort(
      (a, b) => a - b,
    );
    const lessonTasksList: Partial<TaskCode>[] = sortedTaskIds.map(
      (id) => value.tasksMap.get(id)!,
    );

    const lessonMeta: LessonMeta = {
      id: lessonId,
      title: value.meta.title || folderName,
      description: value.meta.description || "",
      color: value.meta.color || "#f54900",
      order: value.meta.order ?? lessons.length + 1,
      icon: value.meta.icon || "Code",
      taskCount: lessonTasksList.length,
      visualEditor: value.meta.visualEditor ?? false,
      visualPreview: value.meta.visualPreview ?? false,
      deleted: value.meta.deleted ?? false,
    };

    const tasksMeta: LessonTasks = {
      lessonId,
      tasks: lessonTasksList,
    };

    lessons.push(lessonMeta);
    tasks.push(tasksMeta);
  });

  return [lessons, tasks];
}