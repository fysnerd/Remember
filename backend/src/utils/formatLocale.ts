/**
 * Locale-aware formatting helpers for backend
 */

function getLocale(language: string): string {
  return language === 'en' ? 'en-US' : 'fr-FR';
}

export function formatDateForUser(date: Date, language: string): string {
  return date.toLocaleDateString(getLocale(language), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateTimeForUser(date: Date, language: string): string {
  return date.toLocaleString(getLocale(language), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
