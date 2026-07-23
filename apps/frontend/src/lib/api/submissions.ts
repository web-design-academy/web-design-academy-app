import { requireOnlineMode } from "@/lib/config/appMode";
import { API_BASE } from "./client";

export interface SubmissionPayload {
  lessonSlug: string;
  taskId: string;
  html: string;
  css: string;
  js: string;
}

export interface SubmissionResponse {
  success: true;
  id: number;
}

export interface SubmissionRecord {
  id: number;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_tags?: UserTag[];
  lesson_slug: string;
  task_id: string;
  html: string;
  css: string;
  js: string;
  timestamp: string;
}

export interface UserTag {
  id: number;
  name: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SubmissionQuery {
  page?: number;
  pageSize?: number;
  tagId?: number | "";
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}

export async function submitSolution(
  payload: SubmissionPayload,
): Promise<SubmissionResponse> {
  requireOnlineMode("Submissions");

  const response = await fetch(`${API_BASE}/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Submission failed");
  }

  return response.json();
}

export async function fetchSubmissions(
  query?: SubmissionQuery,
): Promise<SubmissionRecord[] | PaginatedResponse<SubmissionRecord>> {
  requireOnlineMode("Submissions");

  const params = new URLSearchParams();

  if (query?.page) params.set("page", String(query.page));
  if (query?.pageSize) params.set("pageSize", String(query.pageSize));
  if (query?.tagId) params.set("tagId", String(query.tagId));
  if (query?.sortBy) params.set("sortBy", query.sortBy);
  if (query?.sortDirection) {
    params.set("sortDirection", query.sortDirection);
  }

  const response = await fetch(
    `${API_BASE}/submissions${params.size ? `?${params.toString()}` : ""}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch submissions");
  }

  return response.json();
}

export async function fetchSubmissionById(
  id: string,
): Promise<SubmissionRecord> {
  requireOnlineMode("Submissions");

  const response = await fetch(`${API_BASE}/submissions/${id}`);

  if (!response.ok) {
    throw new Error("Failed to fetch submission");
  }

  return response.json();
}

export async function fetchLatestLessonSubmissions(
  lessonSlug: string,
): Promise<{ items: SubmissionRecord[] }> {
  requireOnlineMode("Submissions");

  const response = await fetch(`${API_BASE}/submissions/latest/${lessonSlug}`);

  if (!response.ok) {
    throw new Error("Failed to fetch latest submissions");
  }

  return response.json();
}
