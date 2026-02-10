// Cron Job Scheduler - Manages all background workers
import cron from 'node-cron';
import { logger } from '../config/logger.js';
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
import { trackJobExecution } from './jobExecutionTracker.js';
import { runCleanupJobExecutions } from './cleanupWorker.js';

const log = logger.child({ component: 'scheduler' });

// Track if scheduler is already running
let isSchedulerRunning = false;

// Track running jobs to prevent overlap
const runningJobs = new Set<string>();

/**
 * Wrapper to prevent job overlap
 */
async function runJob(jobName: string, job: () => Promise<void>, triggerSource: 'SCHEDULED' | 'MANUAL' = 'SCHEDULED'): Promise<void> {
  if (runningJobs.has(jobName)) {
    log.warn({ job: jobName }, 'Skipping job - previous run still in progress');
    return;
  }

  runningJobs.add(jobName);
  try {
    await trackJobExecution(jobName, job, triggerSource);
  } catch (error) {
    // Error already logged by trackJobExecution and persisted to DB.
    // Log here too for PM2 log visibility.
    log.error({ job: jobName, err: error }, 'Job execution failed');
  } finally {
    runningJobs.delete(jobName);
  }
}

/**
 * Initialize all cron jobs
 */
export function startScheduler(): void {
  if (isSchedulerRunning) {
    log.warn('Scheduler already running, skipping initialization');
    return;
  }

  log.info('Initializing cron jobs');

  // YouTube Sync - Every 15 minutes
  // Cron format: minute hour day-of-month month day-of-week
  cron.schedule('*/15 * * * *', async () => {
    log.info({ job: 'youtube-sync' }, 'Triggering scheduled job');
    await runJob('youtube-sync', runYouTubeSync);
  });

  // Spotify Sync - Every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    log.info({ job: 'spotify-sync' }, 'Triggering scheduled job');
    await runJob('spotify-sync', runSpotifySync);
  });

  // TikTok Sync - Every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    log.info({ job: 'tiktok-sync' }, 'Triggering scheduled job');
    await runJob('tiktok-sync', runTikTokSync);
  });

  // YouTube Transcription Worker - Every 2 minutes (optimized)
  // Processes pending YouTube transcription requests (free via subtitles)
  // Also handles INBOX pre-transcription for faster UX when user clicks "Learn"
  cron.schedule('*/2 * * * *', async () => {
    log.info({ job: 'youtube-transcription' }, 'Triggering scheduled job');
    await runJob('youtube-transcription', runTranscriptionWorker);
  });

  // Podcast Transcription Worker - Every 5 minutes (optimized from 10)
  // Processes pending Spotify podcast transcriptions (paid via Whisper)
  cron.schedule('*/5 * * * *', async () => {
    log.info({ job: 'podcast-transcription' }, 'Triggering scheduled job');
    await runJob('podcast-transcription', runPodcastTranscriptionWorker);
  });

  // TikTok Transcription Worker - Every 2 minutes (optimized)
  // Processes pending TikTok transcriptions (via yt-dlp + Whisper)
  cron.schedule('*/2 * * * *', async () => {
    log.info({ job: 'tiktok-transcription' }, 'Triggering scheduled job');
    await runJob('tiktok-transcription', runTikTokTranscriptionWorker);
  });

  // Instagram Sync - Every 30 minutes (Playwright browser automation)
  cron.schedule('*/30 * * * *', async () => {
    log.info({ job: 'instagram-sync' }, 'Triggering scheduled job');
    await runJob('instagram-sync', runInstagramSync);
  });

  // Instagram Transcription Worker - Every 2 minutes (optimized)
  // Processes pending Instagram transcriptions (via yt-dlp + Whisper)
  cron.schedule('*/2 * * * *', async () => {
    log.info({ job: 'instagram-transcription' }, 'Triggering scheduled job');
    await runJob('instagram-transcription', runInstagramTranscriptionWorker);
  });

  // Quiz Generation Worker - Every 2 minutes (optimized)
  // Generates quizzes from transcribed content
  cron.schedule('*/2 * * * *', async () => {
    log.info({ job: 'quiz-generation' }, 'Triggering scheduled job');
    await runJob('quiz-generation', runQuizGenerationWorker);
  });

  // Daily Reminder Worker - Every 5 minutes
  // Sends email reminders to users at their configured time
  cron.schedule('*/5 * * * *', async () => {
    log.info({ job: 'reminder' }, 'Triggering scheduled job');
    await runJob('reminder', runReminderWorker);
  });

  // Auto-Tagging Worker - Every 15 minutes
  // Tags content that has transcripts but no tags
  cron.schedule('*/15 * * * *', async () => {
    log.info({ job: 'auto-tagging' }, 'Triggering scheduled job');
    await runJob('auto-tagging', runAutoTaggingWorker);
  });

  // Job Execution Cleanup - Daily at 3:00 AM
  // Deletes execution records older than 30 days
  cron.schedule('0 3 * * *', async () => {
    log.info({ job: 'cleanup-job-executions' }, 'Triggering scheduled job');
    await runJob('cleanup-job-executions', runCleanupJobExecutions);
  });

  isSchedulerRunning = true;
  log.info({
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
      { name: 'cleanup-job-executions', schedule: '0 3 * * *' },
    ]
  }, 'All cron jobs scheduled');
}

/**
 * Run all sync jobs immediately (useful for testing or manual trigger)
 */
export async function runAllSyncsNow(): Promise<void> {
  log.info('Running all syncs now (manual trigger)');

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

  log.info('All syncs completed');
}

/**
 * Run a specific job manually
 */
export async function triggerJob(
  jobName: 'youtube' | 'spotify' | 'tiktok' | 'instagram' | 'transcription' | 'podcast-transcription' | 'tiktok-transcription' | 'instagram-transcription' | 'quiz-generation' | 'reminder' | 'auto-tagging',
  triggerSource: 'SCHEDULED' | 'MANUAL' = 'SCHEDULED'
): Promise<{ success: boolean; message: string }> {
  switch (jobName) {
    case 'youtube':
      await runJob('youtube-sync', runYouTubeSync, triggerSource);
      return { success: true, message: 'YouTube sync completed' };

    case 'spotify':
      await runJob('spotify-sync', runSpotifySync, triggerSource);
      return { success: true, message: 'Spotify sync completed' };

    case 'tiktok':
      await runJob('tiktok-sync', runTikTokSync, triggerSource);
      return { success: true, message: 'TikTok sync completed' };

    case 'instagram':
      await runJob('instagram-sync', runInstagramSync, triggerSource);
      return { success: true, message: 'Instagram sync completed' };

    case 'transcription':
      await runJob('youtube-transcription', runTranscriptionWorker, triggerSource);
      return { success: true, message: 'YouTube transcription worker completed' };

    case 'podcast-transcription':
      await runJob('podcast-transcription', runPodcastTranscriptionWorker, triggerSource);
      return { success: true, message: 'Podcast transcription worker completed' };

    case 'tiktok-transcription':
      await runJob('tiktok-transcription', runTikTokTranscriptionWorker, triggerSource);
      return { success: true, message: 'TikTok transcription worker completed' };

    case 'instagram-transcription':
      await runJob('instagram-transcription', runInstagramTranscriptionWorker, triggerSource);
      return { success: true, message: 'Instagram transcription worker completed' };

    case 'quiz-generation':
      await runJob('quiz-generation', runQuizGenerationWorker, triggerSource);
      return { success: true, message: 'Quiz generation worker completed' };

    case 'reminder':
      await runJob('reminder', runReminderWorker, triggerSource);
      return { success: true, message: 'Reminder worker completed' };

    case 'auto-tagging':
      await runJob('auto-tagging', runAutoTaggingWorker, triggerSource);
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
      { name: 'cleanup-job-executions', schedule: '0 3 * * *' },
    ],
  };
}
