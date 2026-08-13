import { API_BASE } from "./client";
import type { LessonMeta } from "@/lib/helpers/getLessons";
import type { TaskCode } from "@/lib/helpers/getTasks";

export type LessonDetail = {
  lesson: LessonMeta;
  content: string;
  tasks: Partial<TaskCode>[];
};

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Failed to load lessons");
  }

  return response.json() as Promise<T>;
}

export async function fetchLessons(): Promise<LessonMeta[]> {
  const response = await fetch(`${API_BASE}/lessons`);
  const data = await readResponse<{ items: LessonMeta[] }>(response);
  return data.items;
}

export async function fetchLesson(slug: string): Promise<LessonDetail> {
  const response = await fetch(
    `${API_BASE}/lessons/${encodeURIComponent(slug)}`,
  );
  return readResponse<LessonDetail>(response);
}
