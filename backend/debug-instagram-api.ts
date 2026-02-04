// Debug script: Capture Instagram API requests to understand the structure
// Usage: npx tsx debug-instagram-api.ts

import { prisma } from './src/config/database.js';
import { Platform } from '@prisma/client';
import { chromium } from 'playwright';

const TEST_EMAIL = 'test@remember.app';

async function main() {
  console.log('='.repeat(60));
  console.log('Instagram API Debug');
  console.log('='.repeat(60));

  // 1. Find the test user
  const user = await prisma.user.findUnique({
    where: { email: TEST_EMAIL },
  });

  if (!user) {
    console.error(`User ${TEST_EMAIL} not found!`);
    process.exit(1);
  }

  // 2. Get Instagram cookies
  const connection = await prisma.connectedPlatform.findUnique({
    where: {
      userId_platform: {
        userId: user.id,
        platform: Platform.INSTAGRAM,
      },
    },
  });

  if (!connection) {
    console.error('Instagram not connected!');
    process.exit(1);
  }

  const cookies = JSON.parse(connection.accessToken);
  console.log('Cookies found:', Object.keys(cookies).join(', '));

  // 3. Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  // Inject cookies
  const playwrightCookies = Object.entries(cookies)
    .filter(([_, value]) => value !== undefined)
    .map(([name, value]) => ({
      name,
      value: value as string,
      domain: '.instagram.com',
      path: '/',
    }));
  await context.addCookies(playwrightCookies);

  const page = await context.newPage();

  // 4. Capture ALL API responses
  const capturedAPIs: { url: string; type: string; hasItems: boolean }[] = [];

  page.on('response', async (response) => {
    const url = response.url();

    // Log all Instagram API calls
    if (url.includes('instagram.com') && url.includes('/api/')) {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json')) {
          const data = await response.json();
          const hasItems = !!data.items && Array.isArray(data.items);
          const itemCount = hasItems ? data.items.length : 0;

          // Extract API path
          const apiPath = url.split('instagram.com')[1]?.split('?')[0] || url;

          capturedAPIs.push({
            url: apiPath,
            type: data.items ? `items[${itemCount}]` : Object.keys(data).join(','),
            hasItems,
          });

          if (hasItems && itemCount > 0) {
            console.log(`\n[API] ${apiPath}`);
            console.log(`      Items: ${itemCount}`);

            // Show first item structure
            const firstItem = data.items[0];
            console.log(`      First item keys: ${Object.keys(firstItem).join(', ')}`);

            // Check if it's a reel/video
            if (firstItem.media_type !== undefined) {
              console.log(`      media_type: ${firstItem.media_type} (2=video)`);
            }
            if (firstItem.product_type) {
              console.log(`      product_type: ${firstItem.product_type}`);
            }
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  });

  // 5. Navigate to saved posts
  console.log('\n[1] Navigating to Instagram...');
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Check if logged in
  if (page.url().includes('/accounts/login')) {
    console.error('Session expired! Reconnect Instagram.');
    await browser.close();
    process.exit(1);
  }
  console.log('    Logged in OK');

  // Get username
  let username = '';
  try {
    await page.goto('https://www.instagram.com/accounts/edit/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const usernameInput = await page.$('input[name="username"]');
    if (usernameInput) {
      username = await usernameInput.inputValue();
    }
  } catch {}

  if (!username) {
    username = 'worldwidefys'; // fallback
  }
  console.log(`    Username: ${username}`);

  // 6. Check SAVED posts
  console.log('\n[2] Checking saved posts...');
  await page.goto(`https://www.instagram.com/${username}/saved/all-posts/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Scroll a bit
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(1500);
  }

  // 7. Check LIKED posts (if accessible)
  console.log('\n[3] Checking activity/liked...');
  await page.goto('https://www.instagram.com/your_activity/interactions/likes/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Scroll
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(1500);
  }

  await browser.close();

  // 8. Summary
  console.log('\n' + '='.repeat(60));
  console.log('CAPTURED API ENDPOINTS');
  console.log('='.repeat(60));

  const withItems = capturedAPIs.filter(a => a.hasItems);
  if (withItems.length === 0) {
    console.log('No API endpoints with items found!');
    console.log('\nAll captured endpoints:');
    capturedAPIs.forEach(a => console.log(`  ${a.url} -> ${a.type}`));
  } else {
    withItems.forEach(a => console.log(`  ${a.url} -> ${a.type}`));
  }

  console.log('\n[Recommendation]');
  console.log('The Instagram API endpoints may have changed.');
  console.log('Look for endpoints containing "feed", "saved", or "liked" in the list above.');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
