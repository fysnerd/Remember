/**
 * One-time migration script to backfill channelName for existing content
 *
 * Run with: npx tsx scripts/backfill-channel-names.ts
 */

import { PrismaClient, Platform } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillChannelNames() {
  console.log('Starting channelName backfill...\n');

  // 1. Spotify: Copy showName to channelName
  const spotifyResult = await prisma.content.updateMany({
    where: {
      platform: Platform.SPOTIFY,
      channelName: null,
      showName: { not: null },
    },
    data: {
      // Can't use field reference in updateMany, need raw query
    },
  });

  // Use raw query for Spotify since we need to copy from another field
  const spotifyUpdated = await prisma.$executeRaw`
    UPDATE "Content"
    SET "channelName" = "showName"
    WHERE platform = 'SPOTIFY'
    AND "channelName" IS NULL
    AND "showName" IS NOT NULL
  `;
  console.log(`Spotify: Updated ${spotifyUpdated} records (showName → channelName)`);

  // 2. TikTok: Set channelName to @authorUsername
  const tiktokUpdated = await prisma.$executeRaw`
    UPDATE "Content"
    SET "channelName" = '@' || "authorUsername"
    WHERE platform = 'TIKTOK'
    AND "channelName" IS NULL
    AND "authorUsername" IS NOT NULL
  `;
  console.log(`TikTok: Updated ${tiktokUpdated} records (@authorUsername → channelName)`);

  // 3. Instagram: Set channelName to @authorUsername
  const instagramUpdated = await prisma.$executeRaw`
    UPDATE "Content"
    SET "channelName" = '@' || "authorUsername"
    WHERE platform = 'INSTAGRAM'
    AND "channelName" IS NULL
    AND "authorUsername" IS NOT NULL
  `;
  console.log(`Instagram: Updated ${instagramUpdated} records (@authorUsername → channelName)`);

  // 4. YouTube: Need to fetch from API - for now, just count how many are missing
  const youtubeMissing = await prisma.content.count({
    where: {
      platform: Platform.YOUTUBE,
      channelName: null,
    },
  });
  console.log(`YouTube: ${youtubeMissing} records still missing channelName (will be filled on next sync)`);

  console.log('\nBackfill complete!');
  console.log('Note: YouTube channelName will be populated on next sync.');
}

backfillChannelNames()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
