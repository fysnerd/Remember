// Extract liked reels from Instagram DOM directly
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

  console.log('🔍 Extracting liked reels from DOM...\n');

  await page.goto('https://www.instagram.com/your_activity/interactions/likes/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Scroll to load more content
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(1500);
  }

  // Try multiple selectors to find media links
  const selectors = [
    'a[href*="/reel/"]',
    'a[href*="/p/"]',
    'div[role="button"] a',
    '[data-testid] a[href^="/"]',
  ];

  let allLinks: string[] = [];

  for (const selector of selectors) {
    const links = await page.$$eval(selector, (els) =>
      els.map(el => el.getAttribute('href')).filter(Boolean)
    );
    allLinks.push(...(links as string[]));
  }

  // Also try to find links via parent elements
  const gridLinks = await page.evaluate(() => {
    const links: string[] = [];
    // Find all clickable elements in the main content area
    document.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href');
      if (href && (href.includes('/reel/') || href.includes('/p/'))) {
        links.push(href);
      }
    });
    return links;
  });
  allLinks.push(...gridLinks);

  // Dedupe
  const uniqueLinks = [...new Set(allLinks)];
  const reelLinks = uniqueLinks.filter(l => l.includes('/reel/'));
  const postLinks = uniqueLinks.filter(l => l.includes('/p/') && !l.includes('/reel/'));

  console.log(`📊 Found ${uniqueLinks.length} total media links`);
  console.log(`   🎬 Reels: ${reelLinks.length}`);
  console.log(`   📷 Posts: ${postLinks.length}`);

  if (reelLinks.length > 0) {
    console.log('\n🎬 Liked Reels:');
    reelLinks.slice(0, 15).forEach((link, i) => {
      const shortcode = link.split('/reel/')[1]?.replace('/', '');
      console.log(`   ${i + 1}. https://www.instagram.com/reel/${shortcode}/`);
    });
  } else {
    console.log('\n⚠️ No reel links found in DOM.');
    console.log('   Instagram may be using client-side rendering that hides links.');

    // Try to get any data from the page
    const pageContent = await page.content();
    const reelMatches = pageContent.match(/\/reel\/[A-Za-z0-9_-]+/g);
    if (reelMatches) {
      const uniqueReels = [...new Set(reelMatches)];
      console.log(`\n🔍 Found ${uniqueReels.length} reels in page HTML:`);
      uniqueReels.slice(0, 15).forEach((match, i) => {
        console.log(`   ${i + 1}. https://www.instagram.com${match}/`);
      });
    }
  }

  await browser.close();
  await prisma.$disconnect();
}

main().catch(console.error);
