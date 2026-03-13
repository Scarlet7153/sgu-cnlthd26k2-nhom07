import axios from "axios";

// Use relative path in dev (proxied via Vite), full URL in production
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

const axiosClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

export function unwrapApiData<T = any>(payload: any): T {
  if (payload && typeof payload === "object") {
    if ("data" in payload) {
      return payload.data as T;
    }
    return payload as T;
  }
  return payload as T;
}

export function getApiErrorMessage(error: unknown, fallback = "Đã xảy ra lỗi"): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return "Không thể kết nối tới backend. Vui lòng kiểm tra server.";
    }

    const status = error.response.status;
    const data = error.response.data as any;

    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message;
    }
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }
    if (typeof data?.detail === "string" && data.detail.trim()) {
      return data.detail;
    }

    if (status === 400) return "Dữ liệu gửi lên không hợp lệ.";
    if (status === 401) return "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.";
    if (status === 403) return "Bạn không có quyền thực hiện thao tác này.";
    if (status === 404) return "Không tìm thấy tài nguyên yêu cầu.";
    if (status === 409) return "Dữ liệu bị xung đột.";
    if (status >= 500) return "Backend đang gặp lỗi. Vui lòng thử lại sau.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

axiosClient.interceptors.request.use(
  (config) => {
    const userStr = localStorage.getItem("auth-user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.token) {
          config.headers.Authorization = `Bearer ${user.token}`;
        }
      } catch {
        // Ignore malformed auth-user data
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("auth-user");
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
