/**
 * Secure storage helpers for JWT tokens
 *
 * Uses expo-secure-store for encrypted storage on device.
 * Falls back to localStorage on web (dev preview only).
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

// Web fallback using localStorage (for dev preview only)
const webStorage = {
  getItem: (key: string) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch {}
  },
  deleteItem: (key: string) => {
    try { localStorage.removeItem(key); } catch {}
  },
};

export async function getAccessToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return webStorage.getItem(ACCESS_TOKEN_KEY);
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return webStorage.getItem(REFRESH_TOKEN_KEY);
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setTokens(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    webStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    return;
  }
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      webStorage.deleteItem(ACCESS_TOKEN_KEY);
      webStorage.deleteItem(REFRESH_TOKEN_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    // Ignore errors when clearing
  }
}

export async function hasValidTokens(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== null;
}
