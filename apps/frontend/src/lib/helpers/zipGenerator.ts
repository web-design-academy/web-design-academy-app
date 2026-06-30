import JSZip from "jszip";
import type { LessonMeta } from "./getLessons";
import type { TaskCode } from "./getTasks";

function addCourseToZip(
  zip: JSZip,
  course: LessonMeta,
  tasks: Partial<TaskCode>[],
) {
  const courseFolder = zip.folder(course.slug);
  if (!courseFolder) throw new Error("Failed to create zip folder");

  const mdxContent = `---
title: "${course.title}"
description: "${course.description}"
slug: "${course.slug}"
color: "${course.color}"
order: ${course.order}
icon: ${course.icon}
hidden: ${course.hidden ?? false}
---

# ${course.title}
`;
  courseFolder.file("index.mdx", mdxContent);

  const tasksFolder = courseFolder.folder("tasks");
  if (!tasksFolder) throw new Error("Failed to create tasks folder");

  tasks.forEach((task, index) => {
    const taskId = (index + 1).toString();
    const taskFolder = tasksFolder.folder(taskId);
    if (!taskFolder) return;

    const addFile = (name: string, content?: string) => {
      if (content !== undefined) {
        taskFolder.file(name, content);
      }
    };

    addFile("editable.html", task.editableHtml);
    addFile("editable.css", task.editableCss);
    addFile("editable.js", task.editableJs);
    addFile("readonly.html", task.readonlyHtml);
    addFile("readonly.css", task.readonlyCss);
    addFile("readonly.js", task.readonlyJs);
    addFile("hidden.html", task.hiddenHtml);
    addFile("hidden.css", task.hiddenCss);
    addFile("hidden.js", task.hiddenJs);
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
) {
  const zip = new JSZip();
  addCourseToZip(zip, course, tasks);
  await downloadZip(zip, `${course.slug}.zip`);
}

export async function generateCoursesZip(
  courses: {
    course: LessonMeta;
    tasks: Partial<TaskCode>[];
  }[],
  suggestedName = "lessons.zip",
) {
  const zip = new JSZip();
  courses.forEach(({ course, tasks }) => addCourseToZip(zip, course, tasks));
  await downloadZip(zip, suggestedName);
}
