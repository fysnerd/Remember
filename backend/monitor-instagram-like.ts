// Monitor for new Instagram likes
// Usage: npx tsx monitor-instagram-like.ts

import { prisma } from './src/config/database.js';
import { Platform } from '@prisma/client';
import { syncInstagramForUser } from './src/workers/instagramSync.js';

const TEST_EMAIL = 'test@remember.app';

async function main() {
  console.log('🔍 Instagram Like Monitor');
  console.log('='.repeat(50));

  const user = await prisma.user.findUnique({
    where: { email: TEST_EMAIL },
  });

  if (!user) {
    console.error('User not found!');
    process.exit(1);
  }

  // Get current reel count
  const beforeCount = await prisma.content.count({
    where: { userId: user.id, platform: Platform.INSTAGRAM },
  });

  console.log(`\n📊 Reels before sync: ${beforeCount}`);
  console.log('\n⏳ Syncing Instagram...\n');

  try {
    const newReels = await syncInstagramForUser(user.id);
    console.log(`\n✅ Sync complete! New reels found: ${newReels}`);
  } catch (error: any) {
    console.error('Sync error:', error.message);
  }

  // Get newest reels
  const latestReels = await prisma.content.findMany({
    where: { userId: user.id, platform: Platform.INSTAGRAM },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const afterCount = await prisma.content.count({
    where: { userId: user.id, platform: Platform.INSTAGRAM },
  });

  console.log(`\n📊 Reels after sync: ${afterCount}`);
  console.log(`📈 Difference: +${afterCount - beforeCount}`);

  if (latestReels.length > 0) {
    console.log('\n🆕 Most recent reels:');
    console.log('─'.repeat(50));

    latestReels.forEach((reel, i) => {
      const isNew = (Date.now() - reel.createdAt.getTime()) < 60000; // Created in last minute
      const marker = isNew ? '🔥 NEW!' : '';
      console.log(`\n${i + 1}. ${marker}`);
      console.log(`   Title: ${reel.title?.substring(0, 60)}...`);
      console.log(`   Author: @${reel.authorUsername || 'unknown'}`);
      console.log(`   Duration: ${reel.duration ? reel.duration + 's' : '?'}`);
      console.log(`   URL: ${reel.url}`);
      console.log(`   Added: ${reel.createdAt.toLocaleString()}`);
    });
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
