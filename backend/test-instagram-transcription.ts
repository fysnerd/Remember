// Test script: Sync and transcribe last 10 Instagram reels
// Usage: npx tsx test-instagram-transcription.ts

import { prisma } from './src/config/database.js';
import { Platform, ContentStatus } from '@prisma/client';
import { syncInstagramForUser } from './src/workers/instagramSync.js';
import { processInstagramTranscript } from './src/services/instagramTranscription.js';

const TEST_EMAIL = 'test@remember.app';

async function main() {
  console.log('='.repeat(60));
  console.log('Instagram Transcription Test');
  console.log('='.repeat(60));

  // 1. Find the test user
  const user = await prisma.user.findUnique({
    where: { email: TEST_EMAIL },
  });

  if (!user) {
    console.error(`User ${TEST_EMAIL} not found!`);
    process.exit(1);
  }
  console.log(`\n[1] User found: ${user.name} (${user.id})`);

  // 2. Check if Instagram is connected
  const instagramConnection = await prisma.connectedPlatform.findUnique({
    where: {
      userId_platform: {
        userId: user.id,
        platform: Platform.INSTAGRAM,
      },
    },
  });

  if (!instagramConnection) {
    console.error('\n[ERROR] Instagram not connected!');
    console.log('Go to Settings and connect Instagram first.');
    process.exit(1);
  }
  console.log(`[2] Instagram connected (last sync: ${instagramConnection.lastSyncAt || 'never'})`);

  // 3. Sync Instagram to get latest reels
  console.log('\n[3] Syncing Instagram reels...');
  try {
    const newReels = await syncInstagramForUser(user.id);
    console.log(`    Synced ${newReels} new reels`);
  } catch (error: any) {
    console.error(`    Sync error: ${error.message}`);
    console.log('    Continuing with existing reels...');
  }

  // 4. Get last 10 Instagram reels
  const reels = await prisma.content.findMany({
    where: {
      userId: user.id,
      platform: Platform.INSTAGRAM,
    },
    orderBy: { capturedAt: 'desc' },
    take: 10,
    include: { transcript: true },
  });

  if (reels.length === 0) {
    console.error('\n[ERROR] No Instagram reels found!');
    console.log('Make sure you have liked/saved some reels on Instagram.');
    process.exit(1);
  }

  console.log(`\n[4] Found ${reels.length} Instagram reels:`);
  reels.forEach((reel, i) => {
    const hasTranscript = reel.transcript ? '✓' : '✗';
    const duration = reel.duration ? `${reel.duration}s` : '?s';
    console.log(`    ${i + 1}. [${hasTranscript}] ${reel.title?.substring(0, 50)}... (${duration})`);
  });

  // 5. Find reels without transcript
  const reelsToTranscribe = reels.filter(r => !r.transcript);

  if (reelsToTranscribe.length === 0) {
    console.log('\n[5] All reels already have transcripts!');
    process.exit(0);
  }

  console.log(`\n[5] Transcribing ${reelsToTranscribe.length} reels without transcript...`);

  // 6. Set status to SELECTED and transcribe each
  let success = 0;
  let failed = 0;

  for (const reel of reelsToTranscribe) {
    console.log(`\n--- Processing: ${reel.title?.substring(0, 40)}...`);

    // Update status to SELECTED (required for transcription)
    await prisma.content.update({
      where: { id: reel.id },
      data: { status: ContentStatus.SELECTED },
    });

    try {
      const result = await processInstagramTranscript(reel.id);
      if (result) {
        success++;
        console.log('    Result: SUCCESS');

        // Fetch and show transcript preview
        const updated = await prisma.content.findUnique({
          where: { id: reel.id },
          include: { transcript: true },
        });
        if (updated?.transcript) {
          console.log(`    Language: ${updated.transcript.language}`);
          console.log(`    Length: ${updated.transcript.text.length} chars`);
          console.log(`    Preview: "${updated.transcript.text.substring(0, 100)}..."`);
        }
      } else {
        failed++;
        console.log('    Result: FAILED/UNSUPPORTED');
      }
    } catch (error: any) {
      failed++;
      console.log(`    Result: ERROR - ${error.message}`);
    }

    // Small delay between transcriptions
    await new Promise(r => setTimeout(r, 1000));
  }

  // 7. Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total reels: ${reels.length}`);
  console.log(`Already transcribed: ${reels.length - reelsToTranscribe.length}`);
  console.log(`Newly transcribed: ${success}`);
  console.log(`Failed/Unsupported: ${failed}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
