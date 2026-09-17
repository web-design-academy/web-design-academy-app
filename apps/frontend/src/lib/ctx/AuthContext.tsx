import {useEffect, useState, type ReactNode, useCallback} from "react";
import {
  loginWithGoogle as apiLoginWithGoogle,
  fetchSession,
  logoutSession,
  type AuthData,
  type GoogleLoginPayload,
} from "@/lib/api/auth";
import { isOnlineMode } from "@/lib/config/config.ts";
import { AuthContext, type User } from "./useAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = async (
    payload: GoogleLoginPayload,
  ): Promise<AuthData> => {
    if (!isOnlineMode) {
      throw new Error("Authentication is available only in online mode.");
    }

    const data = await apiLoginWithGoogle(payload);
    setUser({
      userId: data.userId,
      role: data.role,
      name: data.name,
      email: data.email,
      githubId: data.githubId,
      githubLogin: data.githubLogin,
      githubName: data.githubName,
      githubAvatarUrl: data.githubAvatarUrl,
      githubScopes: data.githubScopes
    });

    return data;
  };

  const logout = () => {
    logoutSession().catch(() => {});
    setUser(null);
  };

  const refresh = useCallback(async () => {
    if (!isOnlineMode)
      return;

    try {
      const data = await fetchSession();
      if (!data) {
        setUser(null);
        return;
      }

      setUser({
        userId: data.userId,
        role: data.role,
        name: data.name,
        email: data.email,
        githubId: data.githubId,
        githubLogin: data.githubLogin,
        githubName: data.githubName,
        githubAvatarUrl: data.githubAvatarUrl,
        githubScopes: data.githubScopes
      });
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (!isOnlineMode) {
      setIsLoading(false);
      return;
    }

    refresh().finally(() => {
      setIsLoading(false);
    });
  }, [refresh]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginWithGoogle: login,
        logout,
        refresh
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
