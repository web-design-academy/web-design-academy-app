import { requireOnlineMode } from "@/lib/config/appMode";
import { API_BASE } from "./client";

export interface AuthData {
  userId: string;
  role: "student" | "admin";
  name: string;
  email: string;
}

export type GoogleLoginPayload =
  | { idToken: string; accessToken?: never }
  | { accessToken: string; idToken?: never };

export async function loginWithGoogle(
  payload: GoogleLoginPayload,
): Promise<AuthData> {
  requireOnlineMode("Authentication");

  const response = await fetch(`${API_BASE}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Login failed");
  }

  return response.json();
}

export async function fetchSession(): Promise<AuthData | null> {
  const response = await fetch(`${API_BASE}/auth/me`);

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to fetch session");
  }

  return response.json();
}

export async function logoutSession() {
  const response = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Logout failed");
  }
}
