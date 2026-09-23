import {API_BASE} from "./client";
import type {LessonMeta} from "@/lib/helpers/db.ts";
import type {TaskCode} from "@/lib/helpers/tasks.ts";
import {readResponse} from "@/lib/api/readResponse.ts";

export type LessonDetail = {
  lesson: LessonMeta;
  content: string;
  tasks: Partial<TaskCode>[];
};

export async function fetchLessons(): Promise<LessonMeta[]> {
  const response = await fetch(`${API_BASE}/lessons`);
  const data = await readResponse<{ items: LessonMeta[] }>(response, "Failed to load lessons");
  return data.items;
}

export async function downloadLesson(slug: string): Promise<LessonDetail> {
  const response = await fetch(
    `${API_BASE}/lessons/${encodeURIComponent(slug)}`,
  );
  return readResponse<LessonDetail>(response, "Failed to load lessons");
}
