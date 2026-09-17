import { createContext, useContext } from "react";
import type { AuthData, GoogleLoginPayload } from "../api/auth";

export interface User {
  userId: string;
  role: "student" | "admin";
  name: string;
  email: string;
  githubId?: string;
  githubLogin?: string;
  githubName?: string;
  githubAvatarUrl?: string;
  githubScopes?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogle: (payload: GoogleLoginPayload) => Promise<AuthData>;
  logout: () => void;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
