/**
 * Locale-aware formatting helpers
 * Uses i18n.language to pick the right locale for dates/numbers.
 */

import i18n from './i18n';

function getLocale(): string {
  return i18n.language === 'en' ? 'en-US' : 'fr-FR';
}

export function formatDate(date: Date | string, style: 'short' | 'long' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(getLocale(), {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: style === 'long' ? 'numeric' : undefined,
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(getLocale(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}
