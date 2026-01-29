// Clean old Spotify data and resync with new logic
import { PrismaClient, Platform } from '@prisma/client';
import { runSpotifySync } from './src/workers/spotifySync.js';

const prisma = new PrismaClient();

async function main() {
  // Delete old Spotify content (except seed data which has quizzes)
  console.log('Cleaning old Spotify content without quizzes...');

  const deleted = await prisma.content.deleteMany({
    where: {
      platform: Platform.SPOTIFY,
      quizzes: { none: {} }, // Keep items that have quizzes (seed data)
    },
  });

  console.log(`Deleted ${deleted.count} old Spotify episodes`);

  // Now run the new sync
  console.log('\nRunning new sync (only listened episodes)...');
  await runSpotifySync();

  // Show results
  const newCount = await prisma.content.count({
    where: { platform: Platform.SPOTIFY },
  });

  console.log(`\nTotal Spotify episodes now: ${newCount}`);

  const episodes = await prisma.content.findMany({
    where: { platform: Platform.SPOTIFY },
    select: {
      title: true,
      showName: true,
      listenProgress: true,
      fullyPlayed: true,
    },
    orderBy: { listenProgress: 'desc' },
  });

  console.log('\nEpisodes with progress:');
  episodes.forEach(e => {
    const status = e.fullyPlayed ? '✅' : `▶️ ${e.listenProgress}%`;
    console.log(`  ${status} | ${e.title?.substring(0, 50)} (${e.showName})`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
