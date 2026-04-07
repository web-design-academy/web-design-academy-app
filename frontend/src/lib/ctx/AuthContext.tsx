import { useEffect, useState, type ReactNode } from "react";
import {
  loginWithGoogle as apiLoginWithGoogle,
  fetchSession,
  logoutSession,
  type AuthData,
} from "@/lib/api/auth";
import { isOnlineMode } from "@/lib/config/appMode";
import { AuthContext, type User } from "./useAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOnlineMode) {
      setIsLoading(false);
      return;
    }

    fetchSession()
      .then((session) => {
        if (!session) {
          return;
        }

        setUser({
          userId: session.userId,
          role: session.role,
          name: session.name,
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const loginWithGoogle = async (idToken: string): Promise<AuthData> => {
    if (!isOnlineMode) {
      throw new Error("Authentication is available only in online mode.");
    }

    const data = await apiLoginWithGoogle(idToken);

    setUser({
      userId: data.userId,
      role: data.role,
      name: data.name,
    });

    return data;
  };

  const logout = () => {
    logoutSession().catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
