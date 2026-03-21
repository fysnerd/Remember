/**
 * i18n configuration — bootstrap synchrone (pas de flash)
 *
 * 1. Init synchrone avec expo-localization (device locale)
 * 2. Async override depuis SecureStore (si l'user a manuellement changé)
 * 3. Root layout gate avec i18nReady avant de masquer le splash
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import fr from '../locales/fr.json';
import en from '../locales/en.json';

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function getDeviceLanguage(): SupportedLanguage {
  const deviceLang = Localization.getLocales()[0]?.languageCode || 'fr';
  return SUPPORTED_LANGUAGES.includes(deviceLang as SupportedLanguage)
    ? (deviceLang as SupportedLanguage)
    : 'fr';
}

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: getDeviceLanguage(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

/**
 * Hydrate i18n with the user's stored language preference.
 * Called in _layout.tsx — splash stays visible until resolved.
 */
export async function hydrateI18n(): Promise<void> {
  try {
    const stored = await SecureStore.getItemAsync('ankora_language');
    if (
      stored &&
      SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage) &&
      stored !== i18n.language
    ) {
      await i18n.changeLanguage(stored);
    }
  } catch {
    // SecureStore unavailable (web), ignore
  }
}

/**
 * Persist and apply a language change.
 * Called from profile language switch and after auth (login/signup/refresh).
 */
export async function setLanguage(lang: string): Promise<void> {
  const normalized = SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)
    ? (lang as SupportedLanguage)
    : 'fr';
  if (normalized !== i18n.language) {
    await i18n.changeLanguage(normalized);
  }
  try {
    await SecureStore.setItemAsync('ankora_language', normalized);
  } catch {}
}

export default i18n;
