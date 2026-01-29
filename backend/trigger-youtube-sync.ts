import { runYouTubeSync } from './src/workers/youtubeSync.js';

console.log('Triggering YouTube sync manually...');
runYouTubeSync()
  .then(() => {
    console.log('YouTube sync completed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('YouTube sync failed:', err);
    process.exit(1);
  });
