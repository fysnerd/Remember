import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';
import { queryClient } from '../lib/queryClient';

interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  plan: 'FREE' | 'PRO' | 'LIFETIME';
  trialEndsAt: string | null;
  connectedPlatforms: Array<{
    platform: 'YOUTUBE' | 'SPOTIFY';
    lastSyncAt: string | null;
  }>;
}

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface MeResponse {
  user: User;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        const response = await api.post<AuthResponse>('/auth/login', { email, password });
        const { user, accessToken, refreshToken } = response.data;

        queryClient.clear();
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
      },

      signup: async (email: string, password: string, name?: string) => {
        const response = await api.post<AuthResponse>('/auth/signup', { email, password, name });
        const { user, accessToken, refreshToken } = response.data;

        queryClient.clear();
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
      },

      logout: () => {
        queryClient.clear();
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      setTokens: (accessToken: string, refreshToken: string) => {
        set({ accessToken, refreshToken, isAuthenticated: true });
      },

      fetchUser: async () => {
        const { accessToken } = get();
        if (!accessToken) return;

        try {
          const response = await api.get<MeResponse>('/auth/me');
          set({ user: response.data.user });
        } catch {
          // Token invalid, logout
          get().logout();
        }
      },
    }),
    {
      name: 'remember-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
