// Instagram Authentication Service
// Opens a browser window for the user to login and captures cookies automatically
// Pattern based on tiktokAuth.ts

import { chromium, BrowserContext } from 'playwright';
import { logger } from '../config/logger.js';

const log = logger.child({ service: 'instagram-auth' });

interface InstagramCookies {
  sessionid: string;
  csrftoken?: string;
  ds_user_id?: string;
  mid?: string;
  ig_did?: string;
  ig_nrcb?: string;
  rur?: string;
  datr?: string;
  [key: string]: string | undefined;
}

interface AuthResult {
  success: boolean;
  cookies?: InstagramCookies;
  error?: string;
}

// Store for pending auth sessions (userId -> browser context)
const pendingAuthSessions = new Map<string, { context: BrowserContext; browser: any }>();

/**
 * Start Instagram authentication - opens a browser for the user to login
 * Returns when the user has successfully logged in or after timeout
 */
export async function startInstagramAuth(userId: string): Promise<AuthResult> {
  log.info({ userId, platform: 'instagram' }, 'Starting auth');

  // F2 Fix: Close any existing session for this user before starting a new one
  const existingSession = pendingAuthSessions.get(userId);
  if (existingSession) {
    log.debug({ userId }, 'Closing existing auth session');
    try {
      await existingSession.browser.close();
    } catch {
      // Ignore close errors
    }
    pendingAuthSessions.delete(userId);
  }

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

    // Navigate to Instagram login
    log.debug({ userId }, 'Navigating to Instagram login page');
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded' });

    // Handle cookie consent popup if it appears
    try {
      // Instagram cookie consent - "Allow essential and optional cookies" or "Decline"
      const acceptCookiesBtn = await page.$('button:has-text("Allow essential and optional cookies")');
      if (acceptCookiesBtn) {
        await acceptCookiesBtn.click();
        await page.waitForTimeout(500);
      }
    } catch {
      // Ignore if popup not found
    }

    // Also try to handle "Allow All Cookies" button (different regions)
    try {
      const allowAllBtn = await page.$('button:has-text("Allow all cookies")');
      if (allowAllBtn) {
        await allowAllBtn.click();
        await page.waitForTimeout(500);
      }
    } catch {
      // Ignore if popup not found
    }

    log.debug({ userId }, 'Waiting for user to login');

    // Wait for successful login (check for sessionid cookie)
    // Timeout after 5 minutes
    const maxWaitTime = 5 * 60 * 1000;
    const checkInterval = 2000;
    const startTime = Date.now();

    let cookies: InstagramCookies | null = null;

    while (Date.now() - startTime < maxWaitTime) {
      // Check for sessionid cookie
      const allCookies = await context.cookies('https://www.instagram.com');
      const sessionCookie = allCookies.find(c => c.name === 'sessionid');

      if (sessionCookie && sessionCookie.value && sessionCookie.value.length > 10) {
        log.debug({ userId }, 'Session cookie found');

        // Build cookies object
        cookies = {} as InstagramCookies;
        for (const cookie of allCookies) {
          if (['sessionid', 'csrftoken', 'ds_user_id', 'mid', 'ig_did',
               'ig_nrcb', 'rur', 'datr'].includes(cookie.name)) {
            cookies[cookie.name] = cookie.value;
          }
        }

        // Handle "Save login info" popup if it appears after login
        try {
          await page.waitForTimeout(1000);
          const notNowBtn = await page.$('button:has-text("Not Now")');
          if (notNowBtn) {
            await notNowBtn.click();
            await page.waitForTimeout(500);
          }
        } catch {
          // Ignore if popup not found
        }

        // Handle "Turn on Notifications" popup
        try {
          const notNowNotif = await page.$('button:has-text("Not Now")');
          if (notNowNotif) {
            await notNowNotif.click();
            await page.waitForTimeout(500);
          }
        } catch {
          // Ignore if popup not found
        }

        break;
      }

      await page.waitForTimeout(checkInterval);
    }

    // Cleanup
    pendingAuthSessions.delete(userId);
    await browser.close();

    if (cookies && cookies.sessionid) {
      log.info({ userId, platform: 'instagram' }, 'Auth successful');
      return { success: true, cookies };
    } else {
      log.warn({ userId, platform: 'instagram' }, 'Auth timeout');
      return { success: false, error: 'Authentication timeout. Please try again.' };
    }

  } catch (error) {
    log.error({ err: error, userId, platform: 'instagram' }, 'Auth error');
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
export async function cancelInstagramAuth(userId: string): Promise<void> {
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
