// Cron Job Scheduler - Manages all background workers
import cron from 'node-cron';
import { runYouTubeSync } from './youtubeSync.js';
import { runSpotifySync } from './spotifySync.js';
import { runTikTokSync } from './tiktokSync.js';
import { runTranscriptionWorker } from '../services/transcription.js';
import { runPodcastTranscriptionWorker } from '../services/podcastTranscription.js';
import { runTikTokTranscriptionWorker } from '../services/tiktokTranscription.js';
import { runInstagramSync } from './instagramSync.js';
import { runInstagramTranscriptionWorker } from '../services/instagramTranscription.js';
import { runQuizGenerationWorker } from '../services/quizGeneration.js';
import { runReminderWorker } from './reminderWorker.js';
import { runAutoTaggingWorker } from '../services/tagging.js';

// Track if scheduler is already running
let isSchedulerRunning = false;

// Track running jobs to prevent overlap
const runningJobs = new Set<string>();

/**
 * Wrapper to prevent job overlap
 */
async function runJob(jobName: string, job: () => Promise<void>): Promise<void> {
  if (runningJobs.has(jobName)) {
    console.log(`[Scheduler] Skipping ${jobName} - previous run still in progress`);
    return;
  }

  runningJobs.add(jobName);
  try {
    await job();
  } catch (error) {
    console.error(`[Scheduler] Error in ${jobName}:`, error);
  } finally {
    runningJobs.delete(jobName);
  }
}

/**
 * Initialize all cron jobs
 */
export function startScheduler(): void {
  if (isSchedulerRunning) {
    console.log('[Scheduler] Already running, skipping initialization');
    return;
  }

  console.log('[Scheduler] Initializing cron jobs...');

  // YouTube Sync - Every 15 minutes
  // Cron format: minute hour day-of-month month day-of-week
  cron.schedule('*/15 * * * *', async () => {
    console.log('[Scheduler] Running YouTube sync...');
    await runJob('youtube-sync', runYouTubeSync);
  });

  // Spotify Sync - Every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('[Scheduler] Running Spotify sync...');
    await runJob('spotify-sync', runSpotifySync);
  });

  // TikTok Sync - Every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('[Scheduler] Running TikTok sync...');
    await runJob('tiktok-sync', runTikTokSync);
  });

  // YouTube Transcription Worker - Every 2 minutes (optimized)
  // Processes pending YouTube transcription requests (free via subtitles)
  // Also handles INBOX pre-transcription for faster UX when user clicks "Learn"
  cron.schedule('*/2 * * * *', async () => {
    console.log('[Scheduler] Running YouTube transcription worker...');
    await runJob('youtube-transcription', runTranscriptionWorker);
  });

  // Podcast Transcription Worker - Every 5 minutes (optimized from 10)
  // Processes pending Spotify podcast transcriptions (paid via Whisper)
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Scheduler] Running podcast transcription worker...');
    await runJob('podcast-transcription', runPodcastTranscriptionWorker);
  });

  // TikTok Transcription Worker - Every 2 minutes (optimized)
  // Processes pending TikTok transcriptions (via yt-dlp + Whisper)
  cron.schedule('*/2 * * * *', async () => {
    console.log('[Scheduler] Running TikTok transcription worker...');
    await runJob('tiktok-transcription', runTikTokTranscriptionWorker);
  });

  // Instagram Sync - Every 30 minutes (via private API, no Playwright)
  cron.schedule('*/30 * * * *', async () => {
    console.log('[Scheduler] Running Instagram sync...');
    await runJob('instagram-sync', runInstagramSync);
  });

  // Instagram Transcription Worker - Every 2 minutes (optimized)
  // Processes pending Instagram transcriptions (via yt-dlp + Whisper)
  cron.schedule('*/2 * * * *', async () => {
    console.log('[Scheduler] Running Instagram transcription worker...');
    await runJob('instagram-transcription', runInstagramTranscriptionWorker);
  });

  // Quiz Generation Worker - Every 2 minutes (optimized)
  // Generates quizzes from transcribed content
  cron.schedule('*/2 * * * *', async () => {
    console.log('[Scheduler] Running quiz generation worker...');
    await runJob('quiz-generation', runQuizGenerationWorker);
  });

  // Daily Reminder Worker - Every 5 minutes
  // Sends email reminders to users at their configured time
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Scheduler] Running reminder worker...');
    await runJob('reminder', runReminderWorker);
  });

  // Auto-Tagging Worker - Every 15 minutes
  // Tags content that has transcripts but no tags
  cron.schedule('*/15 * * * *', async () => {
    console.log('[Scheduler] Running auto-tagging worker...');
    await runJob('auto-tagging', runAutoTaggingWorker);
  });

  isSchedulerRunning = true;
  console.log('[Scheduler] All cron jobs scheduled (optimized intervals):');
  console.log('  - YouTube Sync: every 15 minutes');
  console.log('  - Spotify Sync: every 30 minutes');
  console.log('  - TikTok Sync: every 30 minutes');
  console.log('  - Instagram Sync: every 30 minutes (API, no Playwright)');
  console.log('  - YouTube Transcription: every 2 minutes (+ INBOX pre-transcription)');
  console.log('  - Podcast Transcription: every 5 minutes');
  console.log('  - TikTok Transcription: every 2 minutes');
  console.log('  - Instagram Transcription: every 2 minutes');
  console.log('  - Quiz Generation: every 2 minutes');
  console.log('  - Daily Reminders: every 5 minutes');
  console.log('  - Auto-Tagging: every 15 minutes');
}

/**
 * Run all sync jobs immediately (useful for testing or manual trigger)
 */
export async function runAllSyncsNow(): Promise<void> {
  console.log('[Scheduler] Running all syncs now...');

  // Phase 1: Sync content from platforms
  await Promise.allSettled([
    runJob('youtube-sync', runYouTubeSync),
    runJob('spotify-sync', runSpotifySync),
    runJob('tiktok-sync', runTikTokSync),
    runJob('instagram-sync', runInstagramSync),
  ]);

  // Phase 2: Transcribe content
  await Promise.allSettled([
    runJob('youtube-transcription', runTranscriptionWorker),
    runJob('podcast-transcription', runPodcastTranscriptionWorker),
    runJob('tiktok-transcription', runTikTokTranscriptionWorker),
    runJob('instagram-transcription', runInstagramTranscriptionWorker),
  ]);

  // Phase 3: Generate quizzes
  await runJob('quiz-generation', runQuizGenerationWorker);

  console.log('[Scheduler] All syncs completed');
}

/**
 * Run a specific job manually
 */
export async function triggerJob(
  jobName: 'youtube' | 'spotify' | 'tiktok' | 'instagram' | 'transcription' | 'podcast-transcription' | 'tiktok-transcription' | 'instagram-transcription' | 'quiz-generation' | 'reminder' | 'auto-tagging'
): Promise<{ success: boolean; message: string }> {
  switch (jobName) {
    case 'youtube':
      await runJob('youtube-sync', runYouTubeSync);
      return { success: true, message: 'YouTube sync completed' };

    case 'spotify':
      await runJob('spotify-sync', runSpotifySync);
      return { success: true, message: 'Spotify sync completed' };

    case 'tiktok':
      await runJob('tiktok-sync', runTikTokSync);
      return { success: true, message: 'TikTok sync completed' };

    case 'instagram':
      await runJob('instagram-sync', runInstagramSync);
      return { success: true, message: 'Instagram sync completed' };

    case 'transcription':
      await runJob('youtube-transcription', runTranscriptionWorker);
      return { success: true, message: 'YouTube transcription worker completed' };

    case 'podcast-transcription':
      await runJob('podcast-transcription', runPodcastTranscriptionWorker);
      return { success: true, message: 'Podcast transcription worker completed' };

    case 'tiktok-transcription':
      await runJob('tiktok-transcription', runTikTokTranscriptionWorker);
      return { success: true, message: 'TikTok transcription worker completed' };

    case 'instagram-transcription':
      await runJob('instagram-transcription', runInstagramTranscriptionWorker);
      return { success: true, message: 'Instagram transcription worker completed' };

    case 'quiz-generation':
      await runJob('quiz-generation', runQuizGenerationWorker);
      return { success: true, message: 'Quiz generation worker completed' };

    case 'reminder':
      await runJob('reminder', runReminderWorker);
      return { success: true, message: 'Reminder worker completed' };

    case 'auto-tagging':
      await runJob('auto-tagging', runAutoTaggingWorker);
      return { success: true, message: 'Auto-tagging worker completed' };

    default:
      return { success: false, message: `Unknown job: ${jobName}` };
  }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
  isRunning: boolean;
  runningJobs: string[];
  jobs: Array<{ name: string; schedule: string }>;
} {
  return {
    isRunning: isSchedulerRunning,
    runningJobs: Array.from(runningJobs),
    jobs: [
      { name: 'youtube-sync', schedule: '*/15 * * * *' },
      { name: 'spotify-sync', schedule: '*/30 * * * *' },
      { name: 'tiktok-sync', schedule: '*/30 * * * *' },
      { name: 'instagram-sync', schedule: '*/30 * * * *' },
      { name: 'youtube-transcription', schedule: '*/2 * * * *' },
      { name: 'podcast-transcription', schedule: '*/5 * * * *' },
      { name: 'tiktok-transcription', schedule: '*/2 * * * *' },
      { name: 'instagram-transcription', schedule: '*/2 * * * *' },
      { name: 'quiz-generation', schedule: '*/2 * * * *' },
      { name: 'reminder', schedule: '*/5 * * * *' },
      { name: 'auto-tagging', schedule: '*/15 * * * *' },
    ],
  };
}
