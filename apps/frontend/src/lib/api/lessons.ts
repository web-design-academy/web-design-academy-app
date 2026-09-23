import {API_BASE} from "./client";
import type {LessonMeta} from "@/lib/helpers/db.ts";
import type {TaskCode} from "@/lib/helpers/tasks.ts";
import {readResponse} from "@/lib/api/readResponse.ts";
import type {DefaultLesson} from "@/components/Lesson/DefaultLessonBanner.tsx";

export type LessonDetail = {
  lesson: LessonMeta;
  content: string;
  tasks: Partial<TaskCode>[];
};

export async function getLessons() {
  const response = await fetch(`${API_BASE}/lessons`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    }
  });

  return await readResponse<DefaultLesson[]>(response, "Failed to load lessons");
}

export async function getLesson(lessonId: string) {
  const response = await fetch(`${API_BASE}/lessons/${encodeURIComponent(lessonId)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    }
  });

  return await readResponse<DefaultLesson>(response, "Failed to load lesson");
}

export async function downloadLesson(id: string) {
  const response = await fetch(
    `${API_BASE}/lessons/download/${encodeURIComponent(id)}`,
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || "Failed to download repository");
  }

  return response.blob();
}
