import {API_BASE} from "./client";
import {readResponse} from "@/lib/api/readResponse.ts";
import type {DefaultLesson} from "@/interfaces/DefaultLesson.ts";

export async function fetchLessons() {
  const response = await fetch(`${API_BASE}/lessons`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    }
  });

  return await readResponse<DefaultLesson[]>(response, "Failed to load lessons");
}

export async function fetchLesson(lessonId: string) {
  const response = await fetch(`${API_BASE}/lessons/${encodeURIComponent(lessonId)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    }
  });

  return await readResponse<DefaultLesson>(response, "Failed to load lesson");
}

export async function downloadLessonArchive(id: string) {
  const response = await fetch(
    `${API_BASE}/lessons/download/${encodeURIComponent(id)}`,
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || "Failed to download repository");
  }

  return response.blob();
}
