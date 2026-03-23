/**
 * Notification strings for push notifications — FR / EN
 */

import { normalizeLanguage, SupportedLanguage } from './language.js';

const NOTIF: Record<SupportedLanguage, Record<string, string>> = {
  fr: {
    morningTitle_one: 'Ton sujet du jour est prêt !',
    morningTitle_other: 'Tes {{count}} sujets du jour sont prêts !',
    morningStreakSuffix: '{{count}}j de suite !',
    noonTitle_one: '1 nouveau contenu à valider',
    noonTitle_other: '{{count}} nouveaux contenus à valider',
    noonBody: 'Ouvre ta boîte de réception pour trier !',
    afternoonTitle: 'Et si tu révisais un sujet ?',
    eveningTitle: 'Ton streak de {{count}}j est en danger !',
    eveningBody: 'Une petite révision avant de dormir ?',
    inactivityTitle: 'Ça fait un moment !',
    inactivityBody: 'Tes sujets t\'attendent. Une petite session ?',
  },
  en: {
    morningTitle_one: 'Your daily subject is ready!',
    morningTitle_other: 'Your {{count}} daily subjects are ready!',
    morningStreakSuffix: '{{count}}-day streak!',
    noonTitle_one: '1 new content to review',
    noonTitle_other: '{{count}} new contents to review',
    noonBody: 'Open your inbox to sort!',
    afternoonTitle: 'How about reviewing a subject?',
    eveningTitle: 'Your {{count}}-day streak is at risk!',
    eveningBody: 'A quick review before bed?',
    inactivityTitle: 'It\'s been a while!',
    inactivityBody: 'Your subjects are waiting. Quick session?',
  },
};

/**
 * Get a localized notification string, replacing {{count}} with the provided value.
 * For keys ending in _one/_other, pass the base key (e.g. "morningTitle") and supply count.
 */
export function getNotifString(
  key: string,
  language: string | null | undefined,
  vars?: { count?: number },
): string {
  const lang = normalizeLanguage(language);
  const strings = NOTIF[lang];

  // If a count is provided and _one/_other variants exist, pick the right form
  if (vars?.count !== undefined) {
    const pluralKey = vars.count === 1 ? `${key}_one` : `${key}_other`;
    if (strings[pluralKey]) {
      return strings[pluralKey].replace('{{count}}', String(vars.count));
    }
  }

  // Direct key lookup
  const template = strings[key];
  if (!template) {
    // Fallback to French if key not found for the language
    const fallback = NOTIF.fr[key];
    if (!fallback) return key; // return key name as last resort
    return vars?.count !== undefined
      ? fallback.replace('{{count}}', String(vars.count))
      : fallback;
  }

  return vars?.count !== undefined
    ? template.replace('{{count}}', String(vars.count))
    : template;
}
