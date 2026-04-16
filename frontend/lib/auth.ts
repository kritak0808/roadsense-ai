/**
 * Auth helpers — token storage and user state.
 */
import { create } from "zustand";
import { api, User } from "./api";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isLoading: false,

  login: async (username, password) => {
    set({ isLoading: true });
    const { data } = await api.auth.login(username, password);
    localStorage.setItem("access_token", data.data.access_token);
    localStorage.setItem("refresh_token", data.data.refresh_token);
    set({ user: data.data.user, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({ user: null });
    window.location.href = "/login";
  },

  fetchMe: async () => {
    try {
      const { data } = await api.auth.me();
      set({ user: data.data });
    } catch {
      set({ user: null });
    }
  },
}));

export function hasRole(user: User | null, role: "admin" | "analyst" | "viewer"): boolean {
  if (!user) return false;
  const hierarchy = { admin: 3, analyst: 2, viewer: 1 };
  return hierarchy[user.role] >= hierarchy[role];
}
