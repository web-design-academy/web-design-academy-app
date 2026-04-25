import { useEffect, useState, type ReactNode } from "react";
import {
  loginWithGoogle as apiLoginWithGoogle,
  fetchSession,
  logoutSession,
  type AuthData,
} from "@/lib/api/auth";
import { isOnlineMode } from "@/lib/config/appMode";
import { clearAllCustomData } from "@/lib/helpers/adminStorage";
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
          email: session.email,
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      clearAllCustomData();
    }
  }, [isLoading, user]);

  const loginWithGoogle = async (idToken: string): Promise<AuthData> => {
    if (!isOnlineMode) {
      throw new Error("Authentication is available only in online mode.");
    }

    const data = await apiLoginWithGoogle(idToken);

    setUser({
      userId: data.userId,
      role: data.role,
      name: data.name,
      email: data.email,
    });

    return data;
  };

  const logout = () => {
    logoutSession().catch(() => {});
    clearAllCustomData();
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
