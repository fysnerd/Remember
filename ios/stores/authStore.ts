/**
 * Authentication store (Zustand)
 *
 * Manages user authentication state and actions
 */

import { create } from 'zustand';
import api from '../lib/api';
import { setTokens, clearTokens, hasValidTokens } from '../lib/storage';

interface User {
  id: string;
  email: string;
  name?: string;
  plan?: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<LoginResponse>('/auth/login', {
        email,
        password,
      });
      const { accessToken, refreshToken, user } = response.data;
      await setTokens(accessToken, refreshToken);
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Email ou mot de passe incorrect');
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  signup: async (email: string, password: string, name?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<LoginResponse>('/auth/signup', {
        email,
        password,
        name,
      });
      const { accessToken, refreshToken, user } = response.data;
      await setTokens(accessToken, refreshToken);
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Inscription impossible');
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  logout: () => {
    clearTokens();
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const hasTokens = await hasValidTokens();
      if (!hasTokens) {
        set({ isAuthenticated: false, isLoading: false, user: null });
        return;
      }

      const response = await api.get<{ user: User }>('/auth/me');
      set({
        user: response.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      await clearTokens();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));

// Helper to extract error message
function getErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response &&
    error.response.data &&
    typeof error.response.data === 'object' &&
    'error' in error.response.data
  ) {
    const serverError = (error.response.data as { error: string }).error;
    if (serverError.toLowerCase().includes('email already')) {
      return 'Cet email est déjà utilisé';
    }
    if (serverError.toLowerCase().includes('invalid')) {
      return 'Email ou mot de passe incorrect';
    }
    return serverError;
  }
  return fallback;
}
