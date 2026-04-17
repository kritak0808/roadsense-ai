/**
 * Typed API client — wraps all backend endpoints.
 */
import axios, { AxiosInstance } from "axios";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://roadsense-ai-1.onrender.com";

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: true,
  timeout: 120000, // 2 minutes — needed for first PyTorch model load
});

// Attach JWT from localStorage on every request
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
apiClient.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE}/api/auth/refresh`, null, {
            headers: { Authorization: `Bearer ${refresh}` },
          });
          localStorage.setItem("access_token", data.data.access_token);
          err.config.headers.Authorization = `Bearer ${data.data.access_token}`;
          return apiClient(err.config);
        } catch {
          localStorage.clear();
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(err);
  }
);

// ── Typed helpers ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

export interface PredictionResult {
  predicted_class: string;
  confidence: number;
  probabilities: Record<string, number>;
  severity_score: number;
  session_id: string;
  prediction_id: number;
  gradcam_path: string;
  depth: Record<string, unknown>;
  cost_estimate: CostEstimate;
  per_model?: ModelResult[];
  latency_ms: number;
  arch?: string;
}

export interface ModelResult {
  arch: string;
  predicted_class: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface CostEstimate {
  low: number;
  mid: number;
  high: number;
  urgency: string;
  breakdown: { labor: number; materials: number; equipment: number };
  currency: string;
}

export interface HistoryItem {
  id: number;
  session_id: string;
  original_filename: string;
  predicted_class: string;
  confidence: number;
  severity_score: number;
  model_used: string;
  road_segment_id: string | null;
  repair_urgency: string | null;
  created_at: string;
}

export interface StatsData {
  total_predictions: number;
  class_distribution: Record<string, number>;
  average_confidence: number;
  average_severity: number;
  daily_counts: { date: string; count: number }[];
}

export interface LocationItem {
  id: number;
  lat: number;
  lng: number;
  predicted_class: string;
  confidence: number;
  severity_score: number;
  repair_urgency: string | null;
  original_filename: string;
  created_at: string;
}

export interface User {
  id: number;
  uuid: string;
  username: string;
  email: string;
  role: "admin" | "analyst" | "viewer";
  is_active: boolean;
  created_at: string;
}

// ── API functions ─────────────────────────────────────────────────────────────

export const api = {
  predict: {
    single: (form: FormData) =>
      apiClient.post<ApiResponse<PredictionResult>>("/predict", form),
    ensemble: (form: FormData) =>
      apiClient.post<ApiResponse<PredictionResult>>("/predict/ensemble", form),
    videoFrame: (form: FormData) =>
      apiClient.post<ApiResponse<PredictionResult>>("/predict/video_frame", form),
    batch: (form: FormData) =>
      apiClient.post<ApiResponse<{ job_id: string; total: number }>>("/predict/batch", form),
    batchStatus: (jobId: string) =>
      apiClient.get<ApiResponse<{ status: string; progress: number; total: number }>>(`/predict/batch/${jobId}`),
    depth: (form: FormData) =>
      apiClient.post<ApiResponse<Record<string, unknown>>>("/predict/depth", form),
    calibration: () =>
      apiClient.get<ApiResponse<Record<string, number[]>>>("/predict/calibration"),
    modelsList: () =>
      apiClient.get<ApiResponse<unknown[]>>("/predict/models/list"),
    compare: (form: FormData) =>
      apiClient.post<ApiResponse<Record<string, PredictionResult>>>("/predict/models/compare", form),
  },

  history: {
    list: (params?: Record<string, unknown>) =>
      apiClient.get<ApiResponse<{ items: HistoryItem[]; total: number; pages: number }>>("/history", { params }),
    stats: () => apiClient.get<ApiResponse<StatsData>>("/history/stats"),
    exportCsv: () => apiClient.get("/history/export", { responseType: "blob" }),
    exportCoco: () => apiClient.get("/history/export/coco", { responseType: "blob" }),
    timeline: (roadId: string) =>
      apiClient.get<ApiResponse<{ points: unknown[] }>>(`/history/timeline/${roadId}`),
  },

  auth: {
    login: (username: string, password: string) =>
      apiClient.post<ApiResponse<{ access_token: string; refresh_token: string; user: User }>>("/auth/login", { username, password }),
    register: (data: { username: string; email: string; password: string }) =>
      apiClient.post<ApiResponse<User>>("/auth/register", data),
    me: () => apiClient.get<ApiResponse<User>>("/auth/me"),
  },

  admin: {
    users: () => apiClient.get<ApiResponse<User[]>>("/admin/users"),
    updateUser: (id: number, data: Partial<User>) =>
      apiClient.put<ApiResponse<User>>(`/admin/users/${id}`, data),
    deleteUser: (id: number) =>
      apiClient.delete<ApiResponse<unknown>>(`/admin/users/${id}`),
    metrics: () => apiClient.get<ApiResponse<Record<string, unknown>>>("/admin/metrics"),
  },

  weather: (lat: number, lng: number) =>
    apiClient.get<ApiResponse<Record<string, unknown>>>(`/weather/${lat}/${lng}`),

  cost: (data: Record<string, unknown>) =>
    apiClient.post<ApiResponse<CostEstimate>>("/cost/estimate", data),

  report: {
    pdf: (sessionId: string) =>
      apiClient.get(`/report/pdf/${sessionId}`, { responseType: "blob" }),
  },

  retrain: {
    start: (data: Record<string, unknown>) =>
      apiClient.post<ApiResponse<{ job_id: string }>>("/retrain/start", data),
    status: (jobId: string) =>
      apiClient.get<ApiResponse<Record<string, unknown>>>(`/retrain/status/${jobId}`),
    cancel: (jobId: string) =>
      apiClient.post<ApiResponse<unknown>>(`/retrain/cancel/${jobId}`),
  },

  datasets: {
    list: () => apiClient.get<ApiResponse<unknown[]>>("/datasets"),
    upload: (form: FormData) =>
      apiClient.post<ApiResponse<unknown>>("/datasets", form),
    delete: (id: string) =>
      apiClient.delete<ApiResponse<unknown>>(`/datasets/${id}`),
    annotate: (data: Record<string, unknown>) =>
      apiClient.post<ApiResponse<unknown>>("/datasets/annotate", data),
  },

  chat: async (messages: { role: string; content: string }[], context?: Record<string, unknown>) => {
    const resp = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, context }),
    });
    return resp;
  },

  simulate: (form: FormData) =>
    apiClient.post<ApiResponse<{ original_b64: string; repaired_b64: string; predicted_class: string }>>(
      "/simulate/repair", form
    ),

  locations: () =>
    apiClient.get<ApiResponse<LocationItem[]>>("/locations"),
};
