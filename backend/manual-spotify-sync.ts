// Manual Spotify Sync Script
import { runSpotifySync } from './src/workers/spotifySync.js';

console.log('Starting manual Spotify sync...');
runSpotifySync()
  .then(() => {
    console.log('Sync completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Sync failed:', error);
    process.exit(1);
  });
