// Scrape Instagram likes page directly via DOM
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

  console.log('Navigating to likes page...');
  await page.goto('https://www.instagram.com/your_activity/interactions/likes/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Look for links that point to reels
  const reelLinks = await page.$$eval('a[href*="/reel/"]', (links) => {
    return links.map(link => ({
      href: link.getAttribute('href'),
      text: link.textContent?.trim().substring(0, 50),
    }));
  });

  console.log(`\n🎬 Found ${reelLinks.length} reel links:`);
  reelLinks.forEach((link, i) => {
    console.log(`  ${i + 1}. ${link.href}`);
  });

  // Also look for any media elements
  const allLinks = await page.$$eval('a[href*="/p/"], a[href*="/reel/"]', (links) => {
    return links.map(link => ({
      href: link.getAttribute('href'),
      type: link.getAttribute('href')?.includes('/reel/') ? 'reel' : 'post',
    }));
  });

  console.log(`\n📷 All media links: ${allLinks.length}`);
  const reels = allLinks.filter(l => l.type === 'reel');
  const posts = allLinks.filter(l => l.type === 'post');
  console.log(`   Reels: ${reels.length}, Posts: ${posts.length}`);

  if (reels.length > 0) {
    console.log('\n🎬 Reels found:');
    reels.slice(0, 10).forEach((r, i) => {
      console.log(`   ${i + 1}. https://www.instagram.com${r.href}`);
    });
  }


  await browser.close();
  await prisma.$disconnect();
}

main().catch(console.error);
