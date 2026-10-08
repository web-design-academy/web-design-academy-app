import {Dexie, type EntityTable, type Table} from "dexie";
import type {TaskCode} from "@/lib/helpers/tasks.ts";

const SOURCES = ["github", "wda"] as const;

export type Source = typeof SOURCES[number];

function isSource(value: string): value is Source {
  return SOURCES.includes(value as Source);
}

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
  slug: string; // slug:source:id or slug
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
function slugifyTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateId(slug: string): string {
  return slugifyTitle(`${slug}-${crypto.randomUUID().slice(0, 8)}`);
}

export function buildSlug(slug: string, source?: Source, remoteId?: string): string {
  const normalizedSlug = slugifyTitle(slug) || "lesson";

  if (source && remoteId) {
    const normalizedRemoteId = slugifyTitle(remoteId);
    if (normalizedRemoteId)
      return `${normalizedSlug}:${source}:${normalizedRemoteId}`;
  }

  return normalizedSlug;
}

export function decodeSlug(slug: string): { slug: string; source?: Source; remote?: string } {
  const parts = slug.split(":");

  if (parts.length === 3) {
    const [lessonSlug, source, remote] = parts;
    if (lessonSlug && remote && isSource(source)) {
      return {
        slug: lessonSlug,
        source,
        remote,
      };
    }
  }

  return {slug: slugifyTitle(slug) || slug};
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

export function emitLessonDraftsChanged() {
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

export async function existsLessonAsync(id: string): Promise<boolean> {
  const lesson = await db.lessons.get(id);
  return lesson !== undefined;
}

export async function markLessonDeletedAsync(id: string): Promise<void> {
  await db.lessons.update(id, { deleted: true });
  // emitLessonDraftsChanged();
}

export async function markLessonRestoredAsync(id: string): Promise<void> {
  await db.lessons.update(id, { deleted: false });
  // emitLessonDraftsChanged();
}

export async function saveLessonAsync(lesson: LessonMeta): Promise<void> {
  await db.transaction("rw", db.lessons, async () => {
    if (lesson.order === -1) {
      const existing = await db.lessons.toArray();
      existing.sort((a, b) => {
        const orderA = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
        const orderB = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });

      existing.forEach((l, i) => {
        l.order = i + 2;
      });
      await db.lessons.bulkPut(existing);
      lesson.order = 1;
    }

    await db.lessons.put({
      ...lesson,
      deleted: false,
    });
  });

  // emitLessonDraftsChanged();
}

export async function deleteLessonAsync(id: string): Promise<void> {
  await db.transaction("rw", [db.lessons, db.tasks, db.progress, db.content], async () => {
    await deleteTasksAsync(id);
    await deleteLessonContentAsync(id);
    await db.lessons.delete(id);
  });

  // emitLessonDraftsChanged();
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

  // emitLessonDraftsChanged();
}

export async function deleteTasksAsync(id: string): Promise<void> {
  await db.transaction("rw", [db.lessons, db.tasks, db.progress], async () => {
    await db.tasks.delete(id);
    await db.progress.where("lessonId").equals(id).delete();
    await db.lessons.update(id, { taskCount: 0 });
  });

  // emitLessonDraftsChanged();
}

export async function getContentAsync(id: string): Promise<string> {
  const content = await db.content.get(id)
  return content?.content ?? "";
}

export async function saveLessonContentAsync(lessonId: string, content: string) {
  await db.content.put({
    lessonId,
    content
  });
}

export async function deleteLessonContentAsync(lessonId: string) {
  await db.content.delete(lessonId);
}

export async function getProgressAsync(
  lessonId: string,
  userId: string,
): Promise<UserLessonProgress | undefined> {
  return await db.progress.get([userId, lessonId]);
}

export async function saveProgressAsync(
  lessonId: string,
  userId: string,
  completedTasks: FinishedTaskItem[],
): Promise<void> {
  await db.progress.put({
    lessonId,
    userId,
    completedTasks,
  });
}

export async function deleteProgressAsync(
  lessonId: string,
  userId: string,
): Promise<void> {
  await db.progress.delete([userId, lessonId]);
}