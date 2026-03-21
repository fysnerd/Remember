/**
 * Language utilities — shared between authenticated and non-authenticated routes
 */

import { Request } from 'express';

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = 'fr';

/**
 * Normalize any language string to a supported language code.
 * Returns DEFAULT_LANGUAGE for unsupported or invalid values.
 */
export function normalizeLanguage(lang: string | null | undefined): SupportedLanguage {
  const l = (lang || '').substring(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.includes(l as SupportedLanguage)
    ? (l as SupportedLanguage)
    : DEFAULT_LANGUAGE;
}

/**
 * Resolve the language for a request.
 * - Authenticated routes: req.user.language (DB source of truth)
 * - Non-authenticated routes: Accept-Language header → fallback 'fr'
 */
export function resolveRequestLanguage(req: Request): SupportedLanguage {
  // 1. Authenticated user → DB value
  if ((req as any).user?.language) {
    return normalizeLanguage((req as any).user.language);
  }
  // 2. Accept-Language header
  const acceptLang = req.headers['accept-language'];
  if (acceptLang) {
    return normalizeLanguage(acceptLang);
  }
  // 3. Fallback
  return DEFAULT_LANGUAGE;
}
