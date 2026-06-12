import { requireOnlineMode } from "@/lib/config/appMode";

export interface AuthData {
  userId: string;
  role: "student" | "admin";
  name: string;
  email: string;
}

export async function loginWithGoogle(idToken: string): Promise<AuthData> {
  requireOnlineMode("Authentication");

  const response = await fetch("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Login failed");
  }

  return response.json();
}

export async function fetchSession(): Promise<AuthData | null> {
  const response = await fetch("/api/auth/me");

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to fetch session");
  }

  return response.json();
}

export async function logoutSession() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Logout failed");
  }
}
