import { useEffect, useState, type ReactNode } from "react";
import {
  loginWithGoogle as apiLoginWithGoogle,
  getSession,
  saveSession,
  clearSession,
  type AuthData,
} from "@/lib/api/auth";
import { AuthContext, type User } from "./useAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (session) {
      setUser({
        userId: session.userId,
        role: session.role,
        name: session.name,
      });
      setToken(session.token);
    }
    setIsLoading(false);
  }, []);

  const loginWithGoogle = async (idToken: string): Promise<AuthData> => {
    try {
      const data = await apiLoginWithGoogle(idToken);

      saveSession(data);

      setUser({
        userId: data.userId,
        role: data.role,
        name: data.name
      });
      setToken(data.token);

      return data;
    } catch (err) {
      throw err;
    }
  };

  const logout = () => {
    clearSession();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
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
