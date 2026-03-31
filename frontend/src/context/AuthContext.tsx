import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";

import axiosClient, { getApiErrorMessage, unwrapApiData } from "@/lib/axiosClient";

interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role?: string;
  address?: string;
  addressData?: {
    province?: { code?: number | string; name?: string; [key: string]: any };
    district?: { code?: number | string; name?: string; [key: string]: any };
    ward?: { code?: number | string; name?: string; [key: string]: any };
    street?: string;
    houseNumber?: string;
  };
  avatar?: string;
  token?: string;
}

interface BackendAccount {
  id?: string;
  _id?: string;
  email?: string;
  fullName?: string;
  name?: string;
  phone?: string;
  role?: string;
  username?: string;
  status?: string;
}

interface LoginPayload {
  accessToken?: string;
  token?: string;
  account?: BackendAccount;
  user?: BackendAccount;
  data?: {
    account?: BackendAccount;
    user?: BackendAccount;
    accessToken?: string;
  };
}

interface SignUpResult {
  error?: string;
  requiresOtp?: boolean;
  email?: string;
}

interface SignInResult {
  error?: string;
  requiresOtp?: boolean;
  email?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Omit<User, "id" | "email">>) => void;
  verifyOtp: (email: string, otp: string) => Promise<{ error?: string }>;
  resendOtp: (email: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem("auth-user") : null;
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      if (typeof window !== 'undefined') {
        localStorage.removeItem("auth-user");
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(false);

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    try {
      const raw: any = await axiosClient.post("/auth/login", { email, password });
      const authData = unwrapApiData<LoginPayload>(raw);
      
      // Backend trả về: { data: { accessToken, refreshToken, user: {...} } }
      // Hoặc: { accessToken, refreshToken, user: {...} }
      const accessToken = authData?.accessToken || authData?.data?.accessToken;
      const userFromBackend = authData?.user || authData?.account || authData?.data?.user || authData?.data?.account;

      const loggedUser: User = {
        id: userFromBackend?.id || userFromBackend?._id || "",
        email: userFromBackend?.email || email,
        name: userFromBackend?.fullName || userFromBackend?.name || userFromBackend?.email,
        phone: userFromBackend?.phone,
        role: userFromBackend?.role || "USER",
        token: accessToken || ""
      };

      if (!loggedUser.id || !loggedUser.token) {
        return { error: "Phản hồi đăng nhập không hợp lệ từ backend" };
      }

      setUser(loggedUser);
      localStorage.setItem("auth-user", JSON.stringify(loggedUser));

      return {};
    } catch (err: unknown) {
      console.error("Login failed:", err);
      const errorMessage = getApiErrorMessage(err, "Email hoặc mật khẩu không đúng");
      const lowerError = errorMessage.toLowerCase();

      if (lowerError.includes("account not verified") || lowerError.includes("not verified")) {
        return {
          error: "Tài khoản chưa xác thực OTP",
          requiresOtp: true,
          email,
        };
      }

      return { error: errorMessage };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string, phone?: string): Promise<SignUpResult> => {
    try {
      await axiosClient.post("/auth/register", {
        fullName: name,
        email: email,
        password: password,
        phone: phone
      });
      // Register endpoint already triggers OTP flow for unverified accounts.
      return { requiresOtp: true, email };
    } catch (err: unknown) {
      return { error: getApiErrorMessage(err, "Đã xảy ra lỗi đăng ký") };
    }
  }, []);

  const verifyOtp = useCallback(async (email: string, otp: string) => {
    try {
      const raw: any = await axiosClient.post("/auth/verify-otp", { email, code: otp });
      const authData = unwrapApiData<LoginPayload>(raw);
      
      const accessToken = authData?.accessToken || authData?.data?.accessToken;
      const userFromBackend = authData?.user || authData?.account || authData?.data?.user || authData?.data?.account;

      const loggedUser: User = {
        id: userFromBackend?.id || userFromBackend?._id || "",
        email: userFromBackend?.email || email,
        name: userFromBackend?.fullName || userFromBackend?.name || userFromBackend?.email,
        phone: userFromBackend?.phone,
        role: userFromBackend?.role || "USER",
        token: accessToken || ""
      };

      if (loggedUser.id && loggedUser.token) {
        setUser(loggedUser);
        localStorage.setItem("auth-user", JSON.stringify(loggedUser));
      }

      return {};
    } catch (err: unknown) {
      console.error("OTP verification failed:", err);
      return { error: getApiErrorMessage(err, "Mã OTP không đúng hoặc đã hết hạn") };
    }
  }, []);

  const resendOtp = useCallback(async (email: string) => {
    try {
      await axiosClient.post("/auth/resend-otp", { email });
      return {};
    } catch (err: unknown) {
      console.error("Resend OTP failed:", err);
      return { error: getApiErrorMessage(err, "Không thể gửi lại mã OTP") };
    }
  }, []);

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
      const updated = { ...user, ...data };
      setUser(updated);
      localStorage.setItem("auth-user", JSON.stringify(updated));
    } catch {
      // ignore
    }
  }, [user]);

  const value = useMemo<AuthContextValue>(() => ({
    user, loading, signIn, signUp, signOut, updateProfile, verifyOtp, resendOtp,
  }), [user, loading, signIn, signUp, signOut, updateProfile, verifyOtp, resendOtp]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

