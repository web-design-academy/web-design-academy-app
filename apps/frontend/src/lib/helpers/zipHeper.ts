import JSZip from "jszip";
import {ensureReadonlyBlockSpacing} from "./readonlyBlocks";
import {
  buildSlug,
  decodeSlug,
  generateId,
  getContentAsync,
  getTasksAsync,
  type LessonMeta,
  type Source,
} from "@/lib/helpers/db.ts";
import type {TaskCode} from "@/lib/helpers/tasks.ts";
import type {NewLesson} from "@/interfaces/NewLesson.ts";

const OMIT_KEYS = new Set(["id", "order", "taskCount", "deleted", "tasks"]);

const DEFAULT_COLOR = "#00b4ff";
const DEFAULT_ICON = "Download";

function packLessonAsync(
  zip: JSZip,
  course: LessonMeta,
  content: string,
  courseTasks: Partial<TaskCode>[],
): void {
  const slug = decodeSlug(course.slug).slug;
  const courseFolder = zip.folder(slug);
  if (!courseFolder)
    throw new Error("Failed to create zip folder");

  const jsonContent = JSON.stringify(
    course,
    (key, value) => (OMIT_KEYS.has(key) ? undefined : value),
    2,
  );

  courseFolder.file(`${slug}.wdal.json`, jsonContent);
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

async function downloadZipAsync(zip: JSZip, suggestedName: string): Promise<void> {
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
      if ((error as DOMException)?.name === "AbortError")
        return;
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

export async function packLessonsZipAsync(
  courses: LessonMeta[],
  suggestedName: string = "lessons.zip",
): Promise<void> {
  const zip = new JSZip();
  for (const course of courses) {
    packLessonAsync(
      zip,
      course,
      await getContentAsync(course.id),
      await getTasksAsync(course.id),
    );
  }

  await downloadZipAsync(zip, suggestedName);
}

function validateMeta(meta: Partial<LessonMeta>, slugComponents?: {
  source: Source;
  remote: string
}, sha?: string): LessonMeta {
  if (!meta.title || !meta.color || !meta.icon || !meta.slug)
    throw new Error("Lesson metadata is missing required fields");

  const slug = slugComponents
    ? buildSlug(decodeSlug(meta.slug).slug, slugComponents.source, slugComponents.remote)
    : undefined;

  return {
    id: generateId(meta.slug),
    title: meta.title,
    description: meta.description || "",
    color: meta.color || DEFAULT_COLOR,
    icon: meta.icon || DEFAULT_ICON,
    visualPreview: meta.visualPreview ?? false,
    visualEditor: meta.visualEditor ?? false,
    slug: slug || buildSlug(meta.slug || meta.title),
    sha: sha || meta.sha,
    order: -1,
    taskCount: 0,
    deleted: false,
  };
}

function addTaskFileToMap(tasksMap: Map<number, TaskCode>, taskId: number, fileName: string, fileContent: string) {
  if (!tasksMap.has(taskId)) {
    tasksMap.set(taskId, {
      html: "",
      css: "",
      js: "",
    });
  }

  const task = tasksMap.get(taskId)!;

  switch (fileName) {
    case "index.html":
      task.html = fileContent;
      break;
    case "solution.html":
      task.solutionHtml = fileContent;
      break;
    case "styles.css":
      task.css = fileContent;
      break;
    case "solution.css":
      task.solutionCss = fileContent;
      break;
    case "script.js":
      task.js = fileContent;
      break;
    case "solution.js":
      task.solutionJs = fileContent;
      break;
    case "evaluation.json":
      task.evaluation = JSON.parse(fileContent);
      break;
    default:
      throw new Error(`Unrecognized file ${fileName} for task ${taskId}`);
  }
}

export async function parseZipAsync(
  file: Blob,
  slugComponents?: { source: Source; remote: string },
  sha?: string
): Promise<{ lessons: NewLesson[]; errors: string[] }> {
  const lessons: NewLesson[] = [];
  const errors: string[] = [];
  const zip = await JSZip.loadAsync(file);

  const metadataEntries = zip
    .file(/\.wdal\.json$/i)
    .filter((entry) => !entry.name.startsWith("__MACOSX/") && !entry.name.includes("/.DS_Store")
    );

  for (const entry of metadataEntries) {
    try {
      const slashIndex = entry.name.lastIndexOf("/");
      const folder = slashIndex !== -1 ? entry.name.slice(0, slashIndex + 1) : "";

      const parsedMeta = JSON.parse(await entry.async("text")) as Partial<LessonMeta>;
      const lesson: NewLesson = {
        lesson: validateMeta(parsedMeta, slugComponents, sha),
        tasks: [],
      };

      const tasksMap = new Map<number, TaskCode>();

      const lessonFiles = Object.values(zip.files).filter((file) =>
        !file.dir &&
        file.name.startsWith(folder) &&
        !file.name.startsWith("__MACOSX/") &&
        !file.name.includes("/.DS_Store")
      );

      for (const file of lessonFiles) {
        try {
          const filePath = file.name.slice(folder.length);
          const splitPath = filePath.split("/").filter(Boolean);

          if (splitPath.length === 1 && filePath.endsWith(".mdx")) {
            lesson.content = await file.async("text");
          } else if (splitPath.length >= 2) {
            const taskId = parseInt(splitPath[0], 10);
            if (isNaN(taskId))
              continue;

            const fileName = splitPath[splitPath.length - 1];
            addTaskFileToMap(tasksMap, taskId, fileName, await file.async("text"));
          }
        } catch (error) {
          console.error(`Error parsing file ${file.name} for lesson ${lesson.lesson.title}:`, error);
          errors.push(`Error parsing file ${file.name} for lesson ${lesson.lesson.title}: ${error}`);
        }
      }

      lesson.tasks = Array.from(tasksMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, task]) => task);

      lessons.push(lesson);
    } catch (err) {
      console.error(`Error parsing ${entry.name}:`, err);
      errors.push(`Error parsing ${entry.name}: ${err}`);
    }
  }

  return {lessons, errors};
}
