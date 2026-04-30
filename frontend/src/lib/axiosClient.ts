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

// ==================== Request Interceptor ====================
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

// ==================== Response Interceptor with Auto Refresh ====================
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (token) {
      promise.resolve(token);
    } else {
      promise.reject(error);
    }
  });
  failedQueue = [];
};

axiosClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not a refresh/login/register request, try to refresh token
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/register") &&
      !originalRequest.url?.includes("/auth/refresh") &&
      !originalRequest.url?.includes("/auth/forgot-password") &&
      !originalRequest.url?.includes("/auth/reset-password")
    ) {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const userStr = localStorage.getItem("auth-user");
        if (!userStr) throw new Error("No auth data");

        const user = JSON.parse(userStr);
        if (!user.refreshToken) throw new Error("No refresh token");

        // Call refresh endpoint directly with axios (not axiosClient) to avoid interceptor loop
        const refreshResponse = await axios.post(
          `${apiBaseUrl}/auth/refresh`,
          { refreshToken: user.refreshToken },
          { headers: { "Content-Type": "application/json" } }
        );

        const refreshData = refreshResponse.data?.data || refreshResponse.data;
        const newAccessToken = refreshData?.accessToken;
        const newRefreshToken = refreshData?.refreshToken;

        if (!newAccessToken) throw new Error("No access token in refresh response");

        // Update stored user data
        const updatedUser = {
          ...user,
          token: newAccessToken,
          refreshToken: newRefreshToken || user.refreshToken,
        };
        localStorage.setItem("auth-user", JSON.stringify(updatedUser));

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        processQueue(null, newAccessToken);

        return axiosClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Refresh failed — clear auth and let user re-login
        localStorage.removeItem("auth-user");
        // Dispatch a custom event so AuthContext can react
        window.dispatchEvent(new Event("auth:session-expired"));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // For non-401 errors or auth endpoints, just remove user on 401
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("auth-user");
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
