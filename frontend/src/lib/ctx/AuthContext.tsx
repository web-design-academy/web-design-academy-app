import { useEffect, useState, type ReactNode } from "react";
import {
  loginAdmin as apiLoginAdmin,
  loginAnonymous as apiLoginAnonymous,
  getSession,
  saveSession,
  clearSession,
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

  const loginAnonymous = async (email: string, name: string) => {
    const data = await apiLoginAnonymous(email, name);
    saveSession(data);
    setUser({ userId: data.userId, role: data.role, name: data.name });
    setToken(data.token);
  };

  const loginAdmin = async (email: string, password: string) => {
    const data = await apiLoginAdmin(email, password);
    saveSession(data);
    setUser({ userId: data.userId, role: data.role, name: data.name });
    setToken(data.token);
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
        loginAnonymous,
        loginAdmin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
