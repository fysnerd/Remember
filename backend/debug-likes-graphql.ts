// Deep debug: Capture full GraphQL response from Instagram likes page
import { prisma } from './src/config/database.js';
import { Platform } from '@prisma/client';
import { chromium } from 'playwright';
import * as fs from 'fs';

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
  const capturedResponses: any[] = [];

  console.log('🔍 Deep capture of Instagram likes page...\n');

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('instagram.com') && url.includes('graphql')) {
      try {
        const data = await response.json();
        capturedResponses.push({ url, data });

        // Look for anything that might contain media/likes
        const dataStr = JSON.stringify(data);
        if (dataStr.includes('media') || dataStr.includes('like') || dataStr.includes('reel')) {
          console.log(`\n📦 Found potential likes data!`);
          console.log(`   URL: ${url.substring(0, 80)}...`);

          // Save full response for analysis
          const filename = `likes_response_${capturedResponses.length}.json`;
          fs.writeFileSync(filename, JSON.stringify(data, null, 2));
          console.log(`   Saved to: ${filename}`);
        }
      } catch {}
    }

    // Also check REST API
    if (url.includes('/api/v1/') && url.includes('like')) {
      try {
        const data = await response.json();
        console.log(`\n🔥 REST API with 'like': ${url}`);
        if (data.items) console.log(`   Items: ${data.items.length}`);
      } catch {}
    }
  });

  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('Navigating to: /your_activity/interactions/likes/\n');
  await page.goto('https://www.instagram.com/your_activity/interactions/likes/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Scroll to trigger more data loading
  console.log('Scrolling to load more...');
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(2000);
  }

  // Take screenshot for visual inspection
  await page.screenshot({ path: 'likes_page_screenshot.png' });
  console.log('\n📸 Screenshot saved to: likes_page_screenshot.png');

  console.log(`\n✅ Captured ${capturedResponses.length} GraphQL responses`);

  await browser.close();
  await prisma.$disconnect();
}

main().catch(console.error);
