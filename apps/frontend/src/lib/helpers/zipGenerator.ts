import JSZip from "jszip";
import type { LessonMeta } from "./getLessons";
import type { TaskCode } from "./getTasks";
import { ensureReadonlyBlockSpacing } from "./readonlyBlocks";

function addCourseToZip(
  zip: JSZip,
  course: LessonMeta,
  tasks: Partial<TaskCode>[],
  content?: string,
) {
  const courseFolder = zip.folder(course.slug);
  if (!courseFolder) throw new Error("Failed to create zip folder");

  const mdxContent = `---
title: ${JSON.stringify(course.title)}
description: ${JSON.stringify(course.description)}
slug: ${JSON.stringify(course.slug)}
color: ${JSON.stringify(course.color)}
order: ${course.order}
icon: ${JSON.stringify(course.icon)}
hidden: ${course.hidden ?? false}
---

${content?.trim() || `# ${course.title}`}
`;
  courseFolder.file("index.mdx", mdxContent);

  const tasksFolder = courseFolder.folder("tasks");
  if (!tasksFolder) throw new Error("Failed to create tasks folder");

  tasks
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
        taskFolder.file("script.js", ensureReadonlyBlockSpacing(task.js, "js"));
      }
      addFile("solution.html", task.solutionHtml);
      addFile("solution.css", task.solutionCss);
      addFile("solution.js", task.solutionJs);
    });
}

async function downloadZip(zip: JSZip, suggestedName: string) {
  const blob = await zip.generateAsync({ type: "blob" });

  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
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

export async function generateCourseZip(
  course: LessonMeta,
  tasks: Partial<TaskCode>[],
  content?: string,
) {
  const zip = new JSZip();
  addCourseToZip(zip, course, tasks, content);
  await downloadZip(zip, `${course.slug}.zip`);
}

export async function generateCoursesZip(
  courses: {
    course: LessonMeta;
    tasks: Partial<TaskCode>[];
    content?: string;
  }[],
  suggestedName = "lessons.zip",
) {
  const zip = new JSZip();
  courses.forEach(({ course, tasks, content }) =>
    addCourseToZip(zip, course, tasks, content),
  );
  await downloadZip(zip, suggestedName);
}
