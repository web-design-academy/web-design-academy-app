import JSZip from "jszip";
import {ensureReadonlyBlockSpacing} from "./readonlyBlocks";
import {
  getLessonContentAsync,
  getLessonTasksAsync,
  type LessonMeta,
  type LessonTasks,
  slugifyTitle,
  type Source,
} from "@/lib/helpers/db.ts";
import type {TaskCode} from "@/lib/helpers/tasks.ts";

type LessonExport = Omit<LessonMeta, "id" | "order" | "taskCount" | "deleted" | "tasks">;
const OMIT_KEYS = new Set(["id", "order", "taskCount", "deleted", "tasks"]);

function addCourseToZip(
  zip: JSZip,
  course: LessonExport,
  content: string,
  courseTasks: Partial<TaskCode>[],
): void {
  const slug = slugifyTitle(`${course.title}${course.remoteId ? `_${course.remoteId}` : ""}`);
  const courseFolder = zip.folder(slug);
  if (!courseFolder)
    throw new Error("Failed to create zip folder");

  const jsonContent = JSON.stringify(
    course,
    (key, value) => (OMIT_KEYS.has(key) ? undefined : value),
    2,
  );

  courseFolder.file(`${slug}.json`, jsonContent);
  courseFolder.file(`${slug}.mdx`, content ?? "");

  courseTasks
    .filter((task) => !task.deleted)
    .forEach((task, index) => {
      const taskId = (index + 1).toString();
      const taskFolder = courseFolder.folder(taskId);
      if (!taskFolder)
        return;

      const addFile = (name: string, fileContent?: string) => {
        if (fileContent !== undefined && fileContent.trim() !== "")
          taskFolder.file(name, fileContent);
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
    addCourseToZip(
      zip,
      course as LessonExport,
      await getLessonContentAsync(course.id),
      await getLessonTasksAsync(course.id),
    );
  }

  await downloadZip(zip, suggestedName);
}

export async function parseLessonZip(
  file: File | Blob,
  source: Source = "local",
  remoteId: string | undefined = undefined
): Promise<[LessonMeta[], LessonTasks[], Record<string, string>]> {
  const zip = await JSZip.loadAsync(file);
  const lessonsMap = new Map<
    string,
    {
      meta: Partial<LessonMeta>;
      content?: string;
      tasksMap: Map<number, Partial<TaskCode>>;
    }
  >();

  for (const [filePath, fileEntry] of Object.entries(zip.files)) {
    if (fileEntry.dir) continue;
    if (filePath.startsWith("__MACOSX/") || filePath.includes("/.DS_Store")) continue;

    const splitPath = filePath.split("/").filter(Boolean);
    const rootFolder = splitPath[0];
    if (!rootFolder) continue;

    if (!lessonsMap.has(rootFolder)) {
      lessonsMap.set(rootFolder, {
        meta: {},
        tasksMap: new Map(),
      });
    }

    const currentLesson = lessonsMap.get(rootFolder)!;

    if (splitPath.length === 2) {
      const fileName = splitPath[1];

      if (fileName.endsWith(".json")) {
        const metaText = await fileEntry.async("text");
        try {
          const json = JSON.parse(metaText) as Partial<LessonMeta>;
          currentLesson.meta = {...currentLesson.meta, ...json};
        } catch (err) {
          console.error(`Metadata parsing error for ${rootFolder}:`, err);
        }
      } else if (fileName.endsWith(".mdx")) {
        currentLesson.content = await fileEntry.async("text");
      }
    } else if (splitPath.length >= 3) {
      const fileName = splitPath[splitPath.length - 1];
      const taskFolderSegment = splitPath[splitPath.length - 2];
      const taskId = parseInt(taskFolderSegment, 10);

      if (isNaN(taskId)) continue;

      if (!currentLesson.tasksMap.has(taskId)) {
        currentLesson.tasksMap.set(taskId, {});
      }

      const taskTarget = currentLesson.tasksMap.get(taskId)!;
      const fileContent = await fileEntry.async("text");

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
            console.error(`Task parsing error for task ${taskId}:`, err);
          }
          break;
        default:
          break;
      }
    }
  }

  const lessons: LessonMeta[] = [];
  const tasks: LessonTasks[] = [];
  const contents: Record<string, string> = {};

  lessonsMap.forEach((value, folderName) => {
    const lessonId = value.meta.id || folderName;

    const sortedTaskIds = Array.from(value.tasksMap.keys()).sort((a, b) => a - b);
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
      source: source,
      remoteId: remoteId,
      sha: value.meta.sha,
    };

    const tasksMeta: LessonTasks = {
      lessonId,
      tasks: lessonTasksList,
    };

    lessons.push(lessonMeta);
    tasks.push(tasksMeta);
    contents[lessonId] = value.content || "";
  });

  return [lessons, tasks, contents];
}