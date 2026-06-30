import { requireOnlineMode } from "@/lib/config/appMode";
import type { PaginatedResponse, UserTag } from "@/lib/api/submissions";
import { API_BASE } from "@/lib/api/client";

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role: "student" | "admin";
  created_at: string;
  tags: UserTag[];
}

export interface AdminTag extends UserTag {
  user_count: number;
}

export interface PaginatedAdminQuery {
  page: number;
  pageSize: number;
  tagId?: number | "";
}

function buildQuery(query: PaginatedAdminQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });

  if (query.tagId) {
    params.set("tagId", String(query.tagId));
  }

  return params.toString();
}

async function readJsonResponse<T>(response: Response, fallbackMessage: string) {
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || fallbackMessage);
  }

  return response.json() as Promise<T>;
}

export async function fetchAdminTags(): Promise<AdminTag[]> {
  requireOnlineMode("Admin tags");

  const response = await fetch(`${API_BASE}/admin/tags`);
  return readJsonResponse(response, "Failed to fetch tags");
}

export async function fetchAdminUsers(
  query: PaginatedAdminQuery,
): Promise<PaginatedResponse<AdminUser>> {
  requireOnlineMode("Admin users");

  const response = await fetch(`${API_BASE}/admin/users?${buildQuery(query)}`);
  return readJsonResponse(response, "Failed to fetch users");
}

export async function addUserTag(
  userId: string,
  payload: { tagId?: number | ""; name?: string },
) {
  requireOnlineMode("Admin tags");

  const response = await fetch(`${API_BASE}/admin/users/${userId}/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return readJsonResponse<{ success: true; tag: UserTag }>(
    response,
    "Failed to add tag",
  );
}

export async function removeUserTag(userId: string, tagId: number) {
  requireOnlineMode("Admin tags");

  const response = await fetch(`${API_BASE}/admin/users/${userId}/tags/${tagId}`, {
    method: "DELETE",
  });

  return readJsonResponse<{ success: true }>(response, "Failed to remove tag");
}
