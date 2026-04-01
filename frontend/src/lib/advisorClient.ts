import axios from "axios";

const ADVISOR_SESSION_STORAGE_KEY = "advisor-session-id";

export const advisorApiBase: string = import.meta.env.VITE_ADVISOR_API_BASE_URL || "/advisor-api";

export const advisorClient = axios.create({
  baseURL: advisorApiBase,
  headers: {
    "Content-Type": "application/json",
  },
});

advisorClient.interceptors.request.use(
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

advisorClient.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error)
);

export function getAdvisorSessionId(): string {
  const current = localStorage.getItem(ADVISOR_SESSION_STORAGE_KEY);
  if (current && current.trim()) {
    return current;
  }

  const next =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `advisor-${Date.now()}`;
  localStorage.setItem(ADVISOR_SESSION_STORAGE_KEY, next);
  return next;
}
