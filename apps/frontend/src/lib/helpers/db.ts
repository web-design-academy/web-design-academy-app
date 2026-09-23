import {Dexie, type EntityTable, type Table} from "dexie";
import type {TaskCode} from "@/lib/helpers/tasks.ts";

export type Source = "local" | "github" | "wda";

export type LessonTasks = {
  lessonId: string;
  tasks: Partial<TaskCode>[];
};

export type LessonContent = {
  lessonId: string;
  content: string;
};

export type FinishedTaskItem = {
  taskId: string;
  completedAt: Date;
  timeSpent?: number;
};

export type UserLessonProgress = {
  userId: string;
  lessonId: string;
  completedTasks: FinishedTaskItem[];
};

export type LessonMeta = {
  id: string;

  title: string;
  description: string;
  color: string;
  icon: string;
  visualPreview?: boolean;
  visualEditor?: boolean;
  source: Source;
  remoteId?: string;
  sha?: string;

  order: number;
  taskCount: number;
  deleted?: boolean;
};


/**
 * Converts a given title string into a URL-friendly slug by:
 * 1. Trimming leading and trailing whitespace.
 * 2. Converting all characters to lowercase.
 * 3. Replacing non-alphanumeric characters with hyphens.
 * 4. Removing leading and trailing hyphens.
 *
 * @param {string} title - The input string to be slugified.
 * @return {string} The slugified version of the input string.
 */
export function slugifyTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const db = new Dexie("WDA") as Dexie & {
  lessons: EntityTable<LessonMeta, "id">;
  content: EntityTable<LessonContent, "lessonId">
  tasks: EntityTable<LessonTasks, "lessonId">;
  progress: Table<UserLessonProgress, [string, string]>;
};

db.version(1).stores({
  lessons: "id, order",
  tasks: "lessonId",
  progress: "[userId+lessonId], userId, lessonId",
  content: "lessonId"
});

export { db };

function emitLessonDraftsChanged() {
  window.dispatchEvent(new Event("lessonsChanged"));
}

export async function getLessonsAsync(): Promise<LessonMeta[]> {
  const lessons = await db.lessons.toArray();
  return lessons.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getPlayableLessonsAsync(): Promise<LessonMeta[]> {
  const lessons = await db.lessons.toArray();
  return lessons
    .filter((lesson) => !lesson.deleted)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getLessonByIdAsync(id: string): Promise<LessonMeta | undefined> {
  return await db.lessons.get(id);
}

export async function markLessonDeletedAsync(id: string): Promise<void> {
  await db.lessons.update(id, { deleted: true });
  emitLessonDraftsChanged();
}

export async function markLessonRestoredAsync(id: string): Promise<void> {
  await db.lessons.update(id, { deleted: false });
  emitLessonDraftsChanged();
}

export async function saveLessonAsync(lesson: LessonMeta): Promise<void> {
  await db.lessons.put({
    ...lesson,
    deleted: false,
  });
  emitLessonDraftsChanged();
}

export async function deleteLessonAsync(id: string): Promise<void> {
  await db.transaction("rw", [db.lessons, db.tasks, db.progress], async () => {
    await db.lessons.delete(id);
    await db.tasks.delete(id);
    await db.progress.where("lessonId").equals(id).delete();
    await db.content.delete(id);
  });

  emitLessonDraftsChanged();
}

export async function deleteMarkedAsync(): Promise<void> {
  await db.transaction("rw", [db.lessons, db.tasks, db.progress, db.content], async () => {
    const allLessons = await db.lessons.toArray();
    const deletedLessons = allLessons.filter((lesson) => lesson.deleted || false);

    for (const lesson of deletedLessons) {
      await deleteLessonAsync(lesson.id);
    }
  })
}

export async function getTasksAsync(id: string): Promise<Partial<TaskCode>[]> {
  const record = await db.tasks.get(id);
  return record?.tasks ?? [];
}

export async function getTasksCountAsync(id: string): Promise<number> {
  const tasks = await getTasksAsync(id);
  return tasks.length;
}

export async function saveTasksAsync(
  lessonId: string,
  tasks: Partial<TaskCode>[],
): Promise<void> {
  await db.transaction("rw", [db.lessons, db.tasks], async () => {
    await db.tasks.put({
      lessonId,
      tasks,
    });
    await db.lessons.update(lessonId, { taskCount: tasks.length });
  });
  emitLessonDraftsChanged();
}

export async function deleteTasksAsync(id: string): Promise<void> {
  await db.transaction("rw", [db.lessons, db.tasks, db.progress], async () => {
    await db.tasks.delete(id);
    await db.progress.where("lessonId").equals(id).delete();
    await db.lessons.update(id, { taskCount: 0 });
  });
  emitLessonDraftsChanged();
}

export async function getContentAsync(id: string): Promise<string> {
  const content = await db.content.get(id)
  return content?.content ?? "";
}

export async function saveLessonContent(lessonId: string, content: string) {
  await db.content.put({
    lessonId,
    content
  });
}

export async function getProgressAsync(
  lessonId: string,
  userId: string,
): Promise<UserLessonProgress | undefined> {
  return await db.progress.get([userId, lessonId]);
}