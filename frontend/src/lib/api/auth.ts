const ANONYMOUS_URL = "/api/auth/anonymous";
const LOGIN_URL = "/api/auth/login";

export const STORAGE_KEYS = {
  TOKEN: "wa_auth_token",
  USER_ID: "wa_user_id",
  ROLE: "wa_user_role",
  NAME: "wa_user_name",
} as const;

export interface AuthData {
  token: string;
  userId: string;
  role: "student" | "admin";
  name: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Request failed");
  }
  return response.json();
}

export async function loginAnonymous(
  email: string,
  name: string,
): Promise<AuthData> {
  const response = await fetch(ANONYMOUS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name }),
  });
  return handleResponse<AuthData>(response);
}

export async function loginAdmin(
  email: string,
  password: string,
): Promise<AuthData> {
  const response = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<AuthData>(response);
}

export function saveSession(data: AuthData) {
  localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
  localStorage.setItem(STORAGE_KEYS.USER_ID, data.userId);
  localStorage.setItem(STORAGE_KEYS.ROLE, data.role);
  localStorage.setItem(STORAGE_KEYS.NAME, data.name);
}

export function clearSession() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

export function getSession() {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  const userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
  const role = localStorage.getItem(STORAGE_KEYS.ROLE) as
    | "student"
    | "admin"
    | null;
  const name = localStorage.getItem(STORAGE_KEYS.NAME);

  if (token && userId && role) {
    return { token, userId, role, name: name || "User" };
  }
  return null;
}

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}
