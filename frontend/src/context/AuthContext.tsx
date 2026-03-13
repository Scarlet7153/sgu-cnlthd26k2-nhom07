import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";

import axiosClient, { getApiErrorMessage, unwrapApiData } from "@/lib/axiosClient";

interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  address?: string; // Trong User Model backend là 1 entity lồng nhau, nhưng tạm để string/hoặc object
  avatar?: string;
  token?: string; // Để lưu jwt
}

interface BackendAccount {
  id?: string;
  _id?: string;
  email?: string;
  fullName?: string;
  name?: string;
  phone?: string;
}

interface LoginPayload {
  accessToken?: string;
  token?: string;
  account?: BackendAccount;
  user?: BackendAccount;
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

  // Load User từ JS Token Storage lúc F5 
  useEffect(() => {
    try {
      const stored = localStorage.getItem("auth-user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      localStorage.removeItem("auth-user");
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const raw: any = await axiosClient.post("/auth/login", { email, password });
      const authData = unwrapApiData<LoginPayload>(raw);
      const account = authData?.account || authData?.user;

      const loggedUser: User = { 
        id: account?.id || account?._id || "",
        email: account?.email || email,
        name: account?.fullName || account?.name || account?.email,
        phone: account?.phone,
        token: authData?.accessToken || authData?.token || ""
      };

      if (!loggedUser.id || !loggedUser.token) {
        return { error: "Phản hồi đăng nhập không hợp lệ từ backend" };
      }

      setUser(loggedUser);
      localStorage.setItem("auth-user", JSON.stringify(loggedUser));

      return {};
    } catch (err: unknown) {
      console.error("Login failed:", err);
      return { error: getApiErrorMessage(err, "Email hoặc mật khẩu không đúng") };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    try {
      await axiosClient.post("/auth/register", {
        fullName: name,
        email: email,
        password: password
      });

      return await signIn(email, password);
    } catch (err: unknown) {
      return { error: getApiErrorMessage(err, "Đã xảy ra lỗi đăng ký") };
    }
  }, [signIn]);

  const signOut = useCallback(async () => {
    try {
      await axiosClient.post("/auth/logout");
    } catch {
      // Backend có thể chưa có endpoint logout, vẫn cho logout local bình thường.
    }

    setUser(null);
    localStorage.removeItem("auth-user");
  }, []);

  const updateProfile = useCallback((data: Partial<Omit<User, "id" | "email">>) => {
    if (!user) return;
    try {
      // TODO: Đồng bộ endpoint profile theo backend thực tế.
      // await axiosClient.put(`/users/${user.id}`, data);
      
      const updated = { ...user, ...data };
      setUser(updated);
      localStorage.setItem("auth-user", JSON.stringify(updated));
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
