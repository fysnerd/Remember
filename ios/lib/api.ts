/**
 * Axios API client with automatic token refresh
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL } from './constants';
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from './storage';
import i18n from './i18n';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to skip token refresh during logout
let _isLoggingOut = false;
export function setLoggingOut(value: boolean) {
  _isLoggingOut = value;
}

// Request interceptor - add auth token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Send current language to backend on every request
    config.headers['Accept-Language'] = i18n.language || 'fr';
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // If 401 and not already retrying (skip during logout)
    if (error.response?.status === 401 && !originalRequest._retry && !_isLoggingOut) {
      if (isRefreshing) {
        // Wait for token refresh
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        await setTokens(accessToken, newRefreshToken);

        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await clearTokens();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Retry on 429 (rate limited) with backoff
    if (error.response?.status === 429 && !originalRequest._retry) {
      originalRequest._retry = true;
      const retryAfter = Number(error.response.headers['retry-after']) || 2;
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default api;
