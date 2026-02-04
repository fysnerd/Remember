// Quick debug: What API does Instagram likes activity page use?
import { prisma } from './src/config/database.js';
import { Platform } from '@prisma/client';
import { chromium } from 'playwright';

const TEST_EMAIL = 'test@remember.app';

async function main() {
  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  const connection = await prisma.connectedPlatform.findUnique({
    where: { userId_platform: { userId: user!.id, platform: Platform.INSTAGRAM } },
  });

  const cookies = JSON.parse(connection!.accessToken);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });

  const playwrightCookies = Object.entries(cookies)
    .filter(([_, v]) => v !== undefined)
    .map(([name, value]) => ({ name, value: value as string, domain: '.instagram.com', path: '/' }));
  await context.addCookies(playwrightCookies);

  const page = await context.newPage();

  console.log('Capturing ALL API calls on likes page...\n');

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('instagram.com') && (url.includes('/api/') || url.includes('/graphql'))) {
      const contentType = response.headers()['content-type'] || '';
      if (contentType.includes('json')) {
        try {
          const data = await response.json();
          const path = url.split('instagram.com')[1]?.split('?')[0] || url;

          // Check if it has items
          if (data.items && Array.isArray(data.items)) {
            console.log(`📦 ${path}`);
            console.log(`   Items: ${data.items.length}`);
            if (data.items[0]) {
              console.log(`   Keys: ${Object.keys(data.items[0]).slice(0, 5).join(', ')}...`);
              if (data.items[0].media) console.log(`   Has nested 'media' ✓`);
            }
          } else if (data.data) {
            console.log(`📦 ${path} (GraphQL)`);
            console.log(`   Data keys: ${Object.keys(data.data).join(', ')}`);
          }
        } catch {}
      }
    }
  });

  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('Navigating to likes activity page...\n');
  await page.goto('https://www.instagram.com/your_activity/interactions/likes/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Scroll
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(2000);
  }

  await browser.close();
  await prisma.$disconnect();
}

main().catch(console.error);
