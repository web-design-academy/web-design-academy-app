import { requireOnlineMode } from "@/lib/config/appMode";

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
  lesson_slug: string;
  task_id: string;
  html: string;
  css: string;
  js: string;
  timestamp: string;
}

export async function submitSolution(
  payload: SubmissionPayload,
): Promise<SubmissionResponse> {
  requireOnlineMode("Submissions");

  const response = await fetch("/api/submissions", {
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

export async function fetchSubmissions(): Promise<SubmissionRecord[]> {
  requireOnlineMode("Submissions");

  const response = await fetch("/api/submissions");

  if (!response.ok) throw new Error("Failed to fetch submissions");
  return response.json();
}

export async function fetchSubmissionById(
  id: string,
): Promise<SubmissionRecord> {
  requireOnlineMode("Submissions");

  const response = await fetch(`/api/submissions/${id}`);

  if (!response.ok) throw new Error("Failed to fetch submission");
  return response.json();
}
