// Email Service - Daily Review Reminders (S010)
import { config } from '../config/env.js';

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
    console.log('[Email] Resend API key not configured, skipping email');
    console.log('[Email] Would send to:', options.to);
    console.log('[Email] Subject:', options.subject);
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
      console.error('[Email] Failed to send:', error);
      return false;
    }

    console.log('[Email] Sent successfully to:', options.to);
    return true;
  } catch (error) {
    console.error('[Email] Error sending email:', error);
    return false;
  }
}

/**
 * Generate daily review reminder email HTML
 */
export function generateReminderEmail(params: {
  userName: string;
  dueCount: number;
  currentStreak: number;
  reviewUrl: string;
}): { subject: string; html: string; text: string } {
  const { userName, dueCount, currentStreak, reviewUrl } = params;

  const subject = dueCount > 0
    ? `You have ${dueCount} cards waiting for review`
    : 'Keep your streak alive!';

  const streakMessage = currentStreak > 0
    ? `<p style="color: #f97316; font-size: 18px; margin: 20px 0;">
        🔥 Current streak: <strong>${currentStreak} day${currentStreak !== 1 ? 's' : ''}</strong>
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
    <h1 style="color: #6366f1; margin: 0;">Remember</h1>
    <p style="color: #666; margin-top: 5px;">Your daily learning reminder</p>
  </div>

  <div style="background: #f8fafc; border-radius: 12px; padding: 30px; text-align: center;">
    <p style="font-size: 18px; margin-top: 0;">Hi ${userName || 'there'},</p>

    ${dueCount > 0 ? `
    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0;">
      <p style="font-size: 48px; font-weight: bold; color: #6366f1; margin: 0;">${dueCount}</p>
      <p style="color: #64748b; margin: 5px 0 0 0;">cards ready for review</p>
    </div>
    ` : `
    <p style="font-size: 16px; color: #64748b;">
      No cards due right now, but don't break your streak!
    </p>
    `}

    ${streakMessage}

    <a href="${reviewUrl}" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin-top: 20px;">
      Start Review Session
    </a>
  </div>

  <div style="text-align: center; margin-top: 30px; color: #94a3b8; font-size: 14px;">
    <p>
      <a href="${config.frontendUrl}/settings" style="color: #94a3b8;">Manage email preferences</a>
    </p>
    <p style="margin-top: 10px;">
      Remember - Active Learning from Social Media
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Hi ${userName || 'there'},

${dueCount > 0
  ? `You have ${dueCount} cards ready for review.`
  : 'No cards due right now, but don\'t break your streak!'}

${currentStreak > 0 ? `Current streak: ${currentStreak} day${currentStreak !== 1 ? 's' : ''}` : ''}

Start your review session: ${reviewUrl}

---
Remember - Active Learning from Social Media
Manage email preferences: ${config.frontendUrl}/settings
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
}): Promise<boolean> {
  const { email, userName, dueCount, currentStreak } = params;

  const reviewUrl = `${config.frontendUrl}/review`;
  const emailContent = generateReminderEmail({
    userName,
    dueCount,
    currentStreak,
    reviewUrl,
  });

  return sendEmail({
    to: email,
    ...emailContent,
  });
}
