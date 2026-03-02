import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";

interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  address?: string;
  avatar?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Omit<User, "id" | "email">>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Seed default test accounts if none exist
    try {
      const existing = JSON.parse(localStorage.getItem("auth-users") || "[]");
      if (existing.length === 0) {
        const defaultUsers = [
          { id: "admin-001", email: "admin@techpc.vn", password: "admin123", name: "Admin TechPC" },
          { id: "user-001", email: "user@techpc.vn", password: "user123", name: "Nguyễn Văn A" },
        ];
        localStorage.setItem("auth-users", JSON.stringify(defaultUsers));
      }
    } catch {
      // ignore
    }

    // Load user from localStorage
    try {
      const stored = localStorage.getItem("auth-user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    // Mock authentication - check localStorage for stored users
    try {
      const users = JSON.parse(localStorage.getItem("auth-users") || "[]");
      const found = users.find((u: any) => u.email === email && u.password === password);
      
      if (found) {
        const user = { id: found.id, email: found.email, name: found.name };
        setUser(user);
        localStorage.setItem("auth-user", JSON.stringify(user));
        return {};
      }
      return { error: "Email hoặc mật khẩu không đúng" };
    } catch {
      return { error: "Đã xảy ra lỗi" };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    try {
      const users = JSON.parse(localStorage.getItem("auth-users") || "[]");
      
      // Check if email already exists
      if (users.some((u: any) => u.email === email)) {
        return { error: "Email đã được sử dụng" };
      }

      const newUser = {
        id: crypto.randomUUID(),
        email,
        password,
        name,
      };
      
      users.push(newUser);
      localStorage.setItem("auth-users", JSON.stringify(users));
      
      const user = { id: newUser.id, email: newUser.email, name: newUser.name };
      setUser(user);
      localStorage.setItem("auth-user", JSON.stringify(user));
      return {};
    } catch {
      return { error: "Đã xảy ra lỗi" };
    }
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
    localStorage.removeItem("auth-user");
  }, []);

  const updateProfile = useCallback((data: Partial<Omit<User, "id" | "email">>) => {
    if (!user) return;
    try {
      const updated = { ...user, ...data };
      setUser(updated);
      localStorage.setItem("auth-user", JSON.stringify(updated));

      const stored = JSON.parse(localStorage.getItem("auth-users") || "[]");
      const idx = stored.findIndex((u: any) => u.id === user.id);
      if (idx !== -1) {
        stored[idx] = { ...stored[idx], ...data };
        localStorage.setItem("auth-users", JSON.stringify(stored));
      }
    } catch {
      // ignore
    }
  }, [user]);

  const value = useMemo<AuthContextValue>(() => ({
    user, loading, signIn, signUp, signOut, updateProfile,
  }), [user, loading, signIn, signUp, signOut, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
