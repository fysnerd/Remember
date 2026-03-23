// Email Service - Daily Review Reminders (S010)
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { normalizeLanguage, SupportedLanguage } from '../utils/language.js';

const log = logger.child({ service: 'email' });

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using Resend API
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!config.email.resendApiKey) {
    log.warn({ to: options.to, subject: options.subject }, 'Resend API key not configured, skipping email');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.email.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.email.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      log.error({ to: options.to, error }, 'Failed to send email');
      return false;
    }

    log.info({ to: options.to, subject: options.subject }, 'Email sent successfully');
    return true;
  } catch (error) {
    log.error({ err: error, to: options.to }, 'Error sending email');
    return false;
  }
}

// ============================================================================
// Localized email copy
// ============================================================================

const EMAIL_STRINGS: Record<SupportedLanguage, {
  tagline: string;
  greeting: (name: string) => string;
  subjectWithDue: (count: number) => string;
  subjectNoDue: string;
  cardsReady: string;
  noCardsDue: string;
  streakLabel: (count: number) => string;
  ctaButton: string;
  managePrefs: string;
  footer: string;
}> = {
  fr: {
    tagline: 'Ton rappel quotidien',
    greeting: (name) => `Salut ${name || 'toi'},`,
    subjectWithDue: (count) => `${count} carte${count > 1 ? 's' : ''} t'attend${count > 1 ? 'ent' : ''} pour révision`,
    subjectNoDue: 'Garde ton streak en vie !',
    cardsReady: 'cartes prêtes à réviser',
    noCardsDue: 'Aucune carte en attente pour l\'instant, mais ne casse pas ton streak !',
    streakLabel: (count) => `Streak actuel : <strong>${count} jour${count !== 1 ? 's' : ''}</strong>`,
    ctaButton: 'Commencer la révision',
    managePrefs: 'Gérer les préférences email',
    footer: 'Ankora - Apprendre activement depuis les réseaux sociaux',
  },
  en: {
    tagline: 'Your daily learning reminder',
    greeting: (name) => `Hi ${name || 'there'},`,
    subjectWithDue: (count) => `You have ${count} card${count > 1 ? 's' : ''} waiting for review`,
    subjectNoDue: 'Keep your streak alive!',
    cardsReady: 'cards ready for review',
    noCardsDue: 'No cards due right now, but don\'t break your streak!',
    streakLabel: (count) => `Current streak: <strong>${count} day${count !== 1 ? 's' : ''}</strong>`,
    ctaButton: 'Start Review Session',
    managePrefs: 'Manage email preferences',
    footer: 'Ankora - Active Learning from Social Media',
  },
};

/**
 * Generate daily review reminder email HTML
 */
export function generateReminderEmail(params: {
  userName: string;
  dueCount: number;
  currentStreak: number;
  reviewUrl: string;
  language?: string;
}): { subject: string; html: string; text: string } {
  const { userName, dueCount, currentStreak, reviewUrl } = params;
  const lang = normalizeLanguage(params.language);
  const t = EMAIL_STRINGS[lang];

  const subject = dueCount > 0
    ? t.subjectWithDue(dueCount)
    : t.subjectNoDue;

  const streakMessage = currentStreak > 0
    ? `<p style="color: #f97316; font-size: 18px; margin: 20px 0;">
        🔥 ${t.streakLabel(currentStreak)}
       </p>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #D4A574; margin: 0;">Ankora</h1>
    <p style="color: #666; margin-top: 5px;">${t.tagline}</p>
  </div>

  <div style="background: #f8fafc; border-radius: 12px; padding: 30px; text-align: center;">
    <p style="font-size: 18px; margin-top: 0;">${t.greeting(userName)}</p>

    ${dueCount > 0 ? `
    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0;">
      <p style="font-size: 48px; font-weight: bold; color: #6366f1; margin: 0;">${dueCount}</p>
      <p style="color: #64748b; margin: 5px 0 0 0;">${t.cardsReady}</p>
    </div>
    ` : `
    <p style="font-size: 16px; color: #64748b;">
      ${t.noCardsDue}
    </p>
    `}

    ${streakMessage}

    <a href="${reviewUrl}" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin-top: 20px;">
      ${t.ctaButton}
    </a>
  </div>

  <div style="text-align: center; margin-top: 30px; color: #94a3b8; font-size: 14px;">
    <p>
      <a href="${config.frontendUrl}/settings" style="color: #94a3b8;">${t.managePrefs}</a>
    </p>
    <p style="margin-top: 10px;">
      ${t.footer}
    </p>
  </div>
</body>
</html>
  `.trim();

  // Plain text version
  const streakLine = currentStreak > 0
    ? (lang === 'fr'
        ? `Streak actuel : ${currentStreak} jour${currentStreak !== 1 ? 's' : ''}`
        : `Current streak: ${currentStreak} day${currentStreak !== 1 ? 's' : ''}`)
    : '';

  const text = lang === 'fr'
    ? `
${t.greeting(userName)}

${dueCount > 0
  ? `${dueCount} carte${dueCount > 1 ? 's' : ''} prête${dueCount > 1 ? 's' : ''} à réviser.`
  : t.noCardsDue}

${streakLine}

Commencer la révision : ${reviewUrl}

---
${t.footer}
${t.managePrefs} : ${config.frontendUrl}/settings
    `.trim()
    : `
${t.greeting(userName)}

${dueCount > 0
  ? `You have ${dueCount} card${dueCount > 1 ? 's' : ''} ready for review.`
  : t.noCardsDue}

${streakLine}

Start your review session: ${reviewUrl}

---
${t.footer}
${t.managePrefs}: ${config.frontendUrl}/settings
    `.trim();

  return { subject, html, text };
}

/**
 * Send daily review reminder to a user
 */
export async function sendDailyReminder(params: {
  email: string;
  userName: string;
  dueCount: number;
  currentStreak: number;
  language?: string;
}): Promise<boolean> {
  const { email, userName, dueCount, currentStreak, language } = params;

  const reviewUrl = `${config.frontendUrl}/review`;
  const emailContent = generateReminderEmail({
    userName,
    dueCount,
    currentStreak,
    reviewUrl,
    language,
  });

  return sendEmail({
    to: email,
    ...emailContent,
  });
}
