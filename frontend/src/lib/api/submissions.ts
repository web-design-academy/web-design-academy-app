import { getToken } from "./auth";

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
  lesson_slug: string;
  task_id: string;
  html: string;
  css: string;
  js: string;
  status: string;
  timestamp: string;
}

const getHeaders = () => {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
};

export async function submitSolution(
  payload: SubmissionPayload,
): Promise<SubmissionResponse> {
  const response = await fetch("/api/submissions", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Submission failed");
  }

  return response.json();
}

export async function fetchSubmissions(): Promise<SubmissionRecord[]> {
  const response = await fetch("/api/submissions", {
    headers: getHeaders(),
  });

  if (!response.ok) throw new Error("Failed to fetch submissions");
  return response.json();
}

export async function fetchSubmissionById(
  id: string,
): Promise<SubmissionRecord> {
  const response = await fetch(`/api/submissions/${id}`, {
    headers: getHeaders(),
  });

  if (!response.ok) throw new Error("Failed to fetch submission");
  return response.json();
}
