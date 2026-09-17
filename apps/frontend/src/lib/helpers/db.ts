import { Dexie, type EntityTable, type Table } from "dexie";
import type { TaskCode } from "@/lib/helpers/tasks.ts";

export type LessonTasks = {
  lessonId: string;
  tasks: Partial<TaskCode>[];
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
  order: number;
  icon: string;
  taskCount: number;
  visualEditor?: boolean;
  visualPreview?: boolean;
  deleted?: boolean;
};

const db = new Dexie("WDA") as Dexie & {
  lessons: EntityTable<LessonMeta, "id">;
  tasks: EntityTable<LessonTasks, "lessonId">;
  progress: Table<UserLessonProgress, [string, string]>;
};

db.version(1).stores({
  lessons: "id, order",
  tasks: "lessonId",
  progress: "[userId+lessonId], userId, lessonId",
});

export { db };

function emitLessonDraftsChanged() {
  window.dispatchEvent(new Event("lessonsChanged"));
}

export async function clearAllDataAsync(): Promise<void> {
  await db.transaction("rw", [db.lessons, db.tasks, db.progress], async () => {
    await db.lessons.clear();
    await db.tasks.clear();
    await db.progress.clear();
  });
  emitLessonDraftsChanged();
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
  });

  emitLessonDraftsChanged();
}

export async function deleteMarkedLessonsAsync(): Promise<void> {
  await db.transaction("rw", [db.lessons, db.tasks, db.progress], async () => {
    const allLessons = await db.lessons.toArray();
    const deletedLessons = allLessons.filter((lesson) => lesson.deleted || false);

    for (const lesson of deletedLessons) {
      await deleteLessonAsync(lesson.id);
    }
  })
}

export async function getLessonTasksAsync(id: string): Promise<Partial<TaskCode>[]> {
  const record = await db.tasks.get(id);
  return record?.tasks ?? [];
}

export async function getLessonProgressForUser(
  lessonId: string,
  userId: string,
): Promise<UserLessonProgress | undefined> {
  return await db.progress.get([userId, lessonId]);
}

export async function getLessonTasksCountAsync(id: string): Promise<number> {
  const tasks = await getLessonTasksAsync(id);
  return tasks.length;
}

export async function saveLessonTasksAsync(
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

export async function deleteLessonTasksAsync(id: string): Promise<void> {
  await db.transaction("rw", [db.lessons, db.tasks, db.progress], async () => {
    await db.tasks.delete(id);
    await db.progress.where("lessonId").equals(id).delete();
    await db.lessons.update(id, { taskCount: 0 });
  });
  emitLessonDraftsChanged();
}