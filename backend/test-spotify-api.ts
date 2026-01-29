// Test what Spotify API actually returns for listening history
import { PrismaClient, Platform } from '@prisma/client';

const prisma = new PrismaClient();
const SPOTIFY_API = 'https://api.spotify.com/v1';

async function testSpotifyAPI() {
  // Get user's Spotify connection
  const connection = await prisma.connectedPlatform.findFirst({
    where: { platform: Platform.SPOTIFY }
  });

  if (!connection) {
    console.log('No Spotify connection found');
    return;
  }

  const token = connection.accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  // Test 1: Recently played (what user actually listened to)
  console.log('\n=== 1. RECENTLY PLAYED (me/player/recently-played) ===');
  const recentlyPlayed = await fetch(`${SPOTIFY_API}/me/player/recently-played?limit=50`, { headers });
  const recentData = await recentlyPlayed.json();

  if (recentData.items) {
    const episodes = recentData.items.filter((item: any) => item.track?.type === 'episode');
    console.log(`Total items: ${recentData.items.length}`);
    console.log(`Podcast episodes: ${episodes.length}`);
    episodes.slice(0, 5).forEach((item: any) => {
      console.log(`  - ${item.track.name} (played: ${item.played_at})`);
    });
  } else {
    console.log('Error:', recentData);
  }

  // Test 2: Saved episodes (episodes user explicitly saved)
  console.log('\n=== 2. SAVED EPISODES (me/episodes) ===');
  const savedEpisodes = await fetch(`${SPOTIFY_API}/me/episodes?limit=20`, { headers });
  const savedData = await savedEpisodes.json();

  if (savedData.items) {
    console.log(`Saved episodes: ${savedData.items.length}`);
    savedData.items.slice(0, 5).forEach((item: any) => {
      console.log(`  - ${item.episode?.name} (show: ${item.episode?.show?.name})`);
    });
  } else {
    console.log('Error or empty:', savedData);
  }

  // Test 3: Check playback state for current episode
  console.log('\n=== 3. CURRENT PLAYBACK (me/player) ===');
  const playback = await fetch(`${SPOTIFY_API}/me/player`, { headers });
  if (playback.status === 200) {
    const playbackData = await playback.json();
    console.log(`Currently playing: ${playbackData.item?.name || 'Nothing'}`);
    console.log(`Type: ${playbackData.item?.type || 'N/A'}`);
    console.log(`Progress: ${playbackData.progress_ms || 0}ms`);
  } else {
    console.log('No active playback');
  }

  // Test 4: Get shows user follows
  console.log('\n=== 4. FOLLOWED SHOWS (me/shows) ===');
  const shows = await fetch(`${SPOTIFY_API}/me/shows?limit=10`, { headers });
  const showsData = await shows.json();

  if (showsData.items) {
    console.log(`Followed podcasts: ${showsData.total || showsData.items.length}`);
    showsData.items.slice(0, 5).forEach((item: any) => {
      console.log(`  - ${item.show?.name}`);
    });
  }

  await prisma.$disconnect();
}

testSpotifyAPI().catch(console.error);
