/**
 * Authentication store (Zustand)
 *
 * Manages user authentication state and actions
 */

import { create } from 'zustand';
import api, { setLoggingOut } from '../lib/api';
import { setTokens, clearTokens, hasValidTokens } from '../lib/storage';
import { identifyUser, resetUser } from '../lib/purchases';

export interface User {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  plan?: string;
  onboardingCompleted?: boolean;
  onboardingStep?: number;
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
  loginWithApple: (identityToken: string, fullName?: { givenName?: string | null; familyName?: string | null }) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  verifyMagicLink: (token: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  updateUser: (updates: Partial<User>) => void;
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
      identifyUser(user.id);
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
      identifyUser(user.id);
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

  loginWithApple: async (identityToken: string, fullName?) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<LoginResponse>('/auth/apple', {
        identityToken,
        fullName,
      });
      const { accessToken, refreshToken, user } = response.data;
      await setTokens(accessToken, refreshToken);
      identifyUser(user.id);
      set({ user, isAuthenticated: true, isLoading: false, error: null });
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Connexion Apple échouée');
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  loginWithGoogle: async (idToken: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<LoginResponse>('/auth/google', { idToken });
      const { accessToken, refreshToken, user } = response.data;
      await setTokens(accessToken, refreshToken);
      identifyUser(user.id);
      set({ user, isAuthenticated: true, isLoading: false, error: null });
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Connexion Google échouée');
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  sendMagicLink: async (email: string) => {
    set({ error: null });
    try {
      await api.post('/auth/magic-link', { email });
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Impossible d'envoyer le lien");
      set({ error: message });
      throw new Error(message);
    }
  },

  verifyMagicLink: async (token: string, email: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<LoginResponse>('/auth/verify-magic-link', { token, email });
      const { accessToken, refreshToken, user } = response.data;
      await setTokens(accessToken, refreshToken);
      identifyUser(user.id);
      set({ user, isAuthenticated: true, isLoading: false, error: null });
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Lien magique invalide ou expiré');
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  logout: async () => {
    // 1. Disable token refresh in API interceptor
    setLoggingOut(true);
    // 2. Update state immediately (triggers navigation to auth screen)
    set({ user: null, isAuthenticated: false, isLoading: false, error: null });
    // 3. Clean up async resources
    try { await clearTokens(); } catch {}
    try { await resetUser(); } catch {}
    // 4. Re-enable interceptor for next session
    setLoggingOut(false);
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

  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),
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
