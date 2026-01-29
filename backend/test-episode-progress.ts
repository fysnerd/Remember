// Test if we can see playback progress on episodes
import { PrismaClient, Platform } from '@prisma/client';

const prisma = new PrismaClient();
const SPOTIFY_API = 'https://api.spotify.com/v1';

async function testEpisodeProgress() {
  const connection = await prisma.connectedPlatform.findFirst({
    where: { platform: Platform.SPOTIFY }
  });

  if (!connection) {
    console.log('No Spotify connection found');
    return;
  }

  const token = connection.accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  // Get saved episodes with full details
  console.log('=== SAVED EPISODES WITH PROGRESS ===\n');

  const response = await fetch(`${SPOTIFY_API}/me/episodes?limit=20`, { headers });
  const data = await response.json();

  if (!data.items) {
    console.log('Error:', data);
    return;
  }

  for (const item of data.items) {
    const ep = item.episode;
    if (!ep) continue;

    // Check if resume_point is available
    const resumePoint = ep.resume_point;
    const duration = ep.duration_ms;

    let progress = 0;
    let status = '⏸️ Pas commencé';

    if (resumePoint) {
      progress = Math.round((resumePoint.resume_position_ms / duration) * 100);
      if (resumePoint.fully_played) {
        status = '✅ Terminé';
      } else if (resumePoint.resume_position_ms > 0) {
        status = `▶️ En cours (${progress}%)`;
      }
    }

    console.log(`${status} | ${ep.name}`);
    console.log(`   Show: ${ep.show?.name}`);
    console.log(`   Duration: ${Math.round(duration / 60000)} min`);
    if (resumePoint) {
      console.log(`   Progress: ${Math.round(resumePoint.resume_position_ms / 60000)} min / ${Math.round(duration / 60000)} min`);
      console.log(`   Fully played: ${resumePoint.fully_played}`);
    }
    console.log('');
  }

  await prisma.$disconnect();
}

testEpisodeProgress().catch(console.error);
