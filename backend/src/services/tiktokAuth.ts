// TikTok Authentication Service
// Opens a browser window for the user to login and captures cookies automatically

import { chromium, BrowserContext } from 'playwright';
import { logger } from '../config/logger.js';

const log = logger.child({ service: 'tiktok-auth' });

interface TikTokCookies {
  sessionid: string;
  sessionid_ss?: string;
  sid_tt?: string;
  uid_tt?: string;
  msToken?: string;
  tt_chain_token?: string;
  tt_csrf_token?: string;
  passport_csrf_token?: string;
  s_v_web_id?: string;
  odin_tt?: string;
  sid_guard?: string;
  [key: string]: string | undefined;
}

interface AuthResult {
  success: boolean;
  cookies?: TikTokCookies;
  error?: string;
}

// Store for pending auth sessions (userId -> browser context)
const pendingAuthSessions = new Map<string, { context: BrowserContext; browser: any }>();

/**
 * Start TikTok authentication - opens a browser for the user to login
 * Returns when the user has successfully logged in or after timeout
 */
export async function startTikTokAuth(userId: string): Promise<AuthResult> {
  log.info({ userId, platform: 'tiktok' }, 'Starting auth');

  try {
    // Launch browser in visible mode so user can interact
    const browser = await chromium.launch({
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1280,800',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
    });

    // Store session for potential cleanup
    pendingAuthSessions.set(userId, { context, browser });

    const page = await context.newPage();

    // Mask automation indicators
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // @ts-ignore
      delete navigator.__proto__.webdriver;
    });

    // Navigate to TikTok login
    log.debug({ userId }, 'Navigating to TikTok login page');
    await page.goto('https://www.tiktok.com/login', { waitUntil: 'domcontentloaded' });

    // Handle cookie consent popup if it appears
    try {
      const declineBtn = await page.$('button:has-text("Decline")');
      if (declineBtn) {
        await declineBtn.click();
        await page.waitForTimeout(500);
      }
    } catch {
      // Ignore if popup not found
    }

    log.debug({ userId }, 'Waiting for user to login');

    // Wait for successful login (check for profile indicator or sessionid cookie)
    // Timeout after 5 minutes
    const maxWaitTime = 5 * 60 * 1000;
    const checkInterval = 2000;
    const startTime = Date.now();

    let cookies: TikTokCookies | null = null;

    while (Date.now() - startTime < maxWaitTime) {
      // Check for sessionid cookie
      const allCookies = await context.cookies('https://www.tiktok.com');
      const sessionCookie = allCookies.find(c => c.name === 'sessionid');

      if (sessionCookie && sessionCookie.value && sessionCookie.value.length > 10) {
        log.debug({ userId }, 'Session cookie found');

        // Build cookies object
        cookies = {} as TikTokCookies;
        for (const cookie of allCookies) {
          if (['sessionid', 'sessionid_ss', 'sid_tt', 'uid_tt', 'msToken',
               'tt_chain_token', 'tt_csrf_token', 'passport_csrf_token',
               's_v_web_id', 'odin_tt', 'sid_guard'].includes(cookie.name)) {
            cookies[cookie.name] = cookie.value;
          }
        }
        break;
      }

      await page.waitForTimeout(checkInterval);
    }

    // Cleanup
    pendingAuthSessions.delete(userId);
    await browser.close();

    if (cookies && cookies.sessionid) {
      log.info({ userId, platform: 'tiktok' }, 'Auth successful');
      return { success: true, cookies };
    } else {
      log.warn({ userId, platform: 'tiktok' }, 'Auth timeout');
      return { success: false, error: 'Authentication timeout. Please try again.' };
    }

  } catch (error) {
    log.error({ err: error, userId, platform: 'tiktok' }, 'Auth error');
    pendingAuthSessions.delete(userId);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Cancel a pending auth session
 */
export async function cancelTikTokAuth(userId: string): Promise<void> {
  const session = pendingAuthSessions.get(userId);
  if (session) {
    try {
      await session.browser.close();
    } catch {
      // Ignore close errors
    }
    pendingAuthSessions.delete(userId);
  }
}
