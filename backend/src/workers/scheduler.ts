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
import { runQuizGenerationWorker, runSynopsisBackfill } from '../services/quizGeneration.js';
import { runReminderWorker } from './reminderWorker.js';
import { runAutoTaggingWorker } from '../services/tagging.js';
import { runThemeClassificationWorker, runBackfillThemes } from '../services/themeClassification.js';
import { runEmbeddingWorker, runEmbeddingBackfill } from '../services/embeddingGeneration.js';
import { runThemeProgressWorker, backfillThemeProgress } from '../services/themeProgress.js';
import { runThemeRecallWorker } from '../workers/themeRecallWorker.js';
import { trackJobExecution } from './jobExecutionTracker.js';
import { runCleanupJobExecutions } from './cleanupWorker.js';
import { cleanupDesktopAuthSessions } from '../routes/oauth.js';
import { prisma } from '../config/database.js';
import { ContentStatus } from '@prisma/client';

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

  // TikTok Sync - Every 12 hours (low volume, mainly on-demand via /content/refresh)
  cron.schedule('0 */12 * * *', async () => {
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

  // Instagram — DISABLED (2026-03-26): feature parked, re-enable later
  // Instagram Sync - NO CRON: was triggered only on-demand via /content/refresh
  // Instagram Transcription Worker - was every 2 minutes
  // cron.schedule('*/2 * * * *', async () => {
  //   log.info({ job: 'instagram-transcription' }, 'Triggering scheduled job');
  //   await runJob('instagram-transcription', runInstagramTranscriptionWorker);
  // });

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

  // Theme Classification Worker - Every 15 minutes
  // Generates themes from tag clusters and classifies new content into existing themes
  cron.schedule('*/15 * * * *', async () => {
    log.info({ job: 'theme-classification' }, 'Triggering scheduled job');
    await runJob('theme-classification', runThemeClassificationWorker);
  });

  // Embedding Generation Worker - Every 5 minutes
  // Generates vector embeddings for TranscriptCache entries
  cron.schedule('*/5 * * * *', async () => {
    log.info({ job: 'embedding-generation' }, 'Triggering scheduled job');
    await runJob('embedding-generation', runEmbeddingWorker);
  });

  // Theme Progress Worker - Every hour
  // Computes per-theme learning metrics and manages phase transitions (FSRS-5 Phase 2)
  cron.schedule('0 * * * *', async () => {
    log.info({ job: 'theme-progress' }, 'Triggering scheduled job');
    await runJob('theme-progress', runThemeProgressWorker);
  });

  // Theme Recall Worker - Every 30 minutes
  // Checks for due recall quizzes and sends push notifications (FSRS-5 Phase 3)
  cron.schedule('*/30 * * * *', async () => {
    log.info({ job: 'theme-recall' }, 'Triggering scheduled job');
    await runJob('theme-recall', runThemeRecallWorker);
  });

  // Job Execution Cleanup - Daily at 3:00 AM
  // Deletes execution records older than 30 days
  cron.schedule('0 3 * * *', async () => {
    log.info({ job: 'cleanup-job-executions' }, 'Triggering scheduled job');
    await runJob('cleanup-job-executions', runCleanupJobExecutions);
  });

  // Inbox Auto-Expiration - Daily at 3:15 AM
  // Archives INBOX items older than 7 days that users haven't triaged
  cron.schedule('15 3 * * *', async () => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const result = await prisma.content.updateMany({
        where: {
          status: ContentStatus.INBOX,
          createdAt: { lt: sevenDaysAgo },
        },
        data: { status: ContentStatus.ARCHIVED },
      });
      if (result.count > 0) {
        log.info({ expired: result.count }, 'Auto-expired old inbox items');
      }
    } catch (error) {
      log.error({ err: error }, 'Failed to auto-expire inbox items');
    }
  });

  // Desktop Auth Session Cleanup - Every minute
  // Removes expired pending desktop auth sessions (>10 min old)
  cron.schedule('* * * * *', () => {
    cleanupDesktopAuthSessions();
  });

  isSchedulerRunning = true;
  log.info({
    jobs: [
      { name: 'youtube-sync', schedule: '*/15 * * * *' },
      { name: 'spotify-sync', schedule: '*/30 * * * *' },
      { name: 'tiktok-sync', schedule: '0 */12 * * *' },
      { name: 'instagram-sync', schedule: 'on-demand only (5min cooldown)' },
      { name: 'youtube-transcription', schedule: '*/2 * * * *' },
      { name: 'podcast-transcription', schedule: '*/5 * * * *' },
      { name: 'tiktok-transcription', schedule: '*/2 * * * *' },
      { name: 'instagram-transcription', schedule: '*/2 * * * *' },
      { name: 'quiz-generation', schedule: '*/2 * * * *' },
      { name: 'reminder', schedule: '*/5 * * * *' },
      { name: 'auto-tagging', schedule: '*/15 * * * *' },
      { name: 'theme-classification', schedule: '*/15 * * * *' },
      { name: 'embedding-generation', schedule: '*/5 * * * *' },
      { name: 'theme-progress', schedule: '0 * * * *' },
      { name: 'theme-recall', schedule: '*/30 * * * *' },
      { name: 'cleanup-job-executions', schedule: '0 3 * * *' },
      { name: 'inbox-auto-expiration', schedule: '15 3 * * *' },
      { name: 'desktop-auth-cleanup', schedule: '* * * * *' },
    ]
  }, 'All cron jobs scheduled');
}

/**
 * Run all sync jobs immediately (useful for testing or manual trigger)
 */
export async function runAllSyncsNow(): Promise<void> {
  log.info('Running all syncs now (manual trigger)');

  // Phase 1: Sync content from platforms (Instagram excluded — on-demand only)
  await Promise.allSettled([
    runJob('youtube-sync', runYouTubeSync),
    runJob('spotify-sync', runSpotifySync),
    runJob('tiktok-sync', runTikTokSync),
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
  jobName: 'youtube' | 'spotify' | 'tiktok' | 'instagram' | 'transcription' | 'podcast-transcription' | 'tiktok-transcription' | 'instagram-transcription' | 'quiz-generation' | 'reminder' | 'auto-tagging' | 'theme-classification' | 'theme-backfill' | 'embedding-generation' | 'embedding-backfill' | 'synopsis-backfill' | 'theme-progress' | 'theme-progress-backfill' | 'theme-recall',
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

    case 'theme-classification':
      await runJob('theme-classification', runThemeClassificationWorker, triggerSource);
      return { success: true, message: 'Theme classification worker completed' };

    case 'theme-backfill':
      await runJob('theme-backfill', runBackfillThemes, triggerSource);
      return { success: true, message: 'Theme backfill completed' };

    case 'embedding-generation':
      await runJob('embedding-generation', runEmbeddingWorker, triggerSource);
      return { success: true, message: 'Embedding generation worker completed' };

    case 'embedding-backfill':
      await runJob('embedding-backfill', runEmbeddingBackfill, triggerSource);
      return { success: true, message: 'Embedding backfill completed' };

    case 'synopsis-backfill':
      await runJob('synopsis-backfill', runSynopsisBackfill, triggerSource);
      return { success: true, message: 'Synopsis backfill completed' };

    case 'theme-progress':
      await runJob('theme-progress', runThemeProgressWorker, triggerSource);
      return { success: true, message: 'Theme progress worker completed' };

    case 'theme-progress-backfill':
      await runJob('theme-progress-backfill', backfillThemeProgress, triggerSource);
      return { success: true, message: 'Theme progress backfill completed' };

    case 'theme-recall':
      await runJob('theme-recall', runThemeRecallWorker, triggerSource);
      return { success: true, message: 'Theme recall worker completed' };

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
      { name: 'tiktok-sync', schedule: '0 */12 * * *' },
      { name: 'instagram-sync', schedule: 'on-demand only (5min cooldown)' },
      { name: 'youtube-transcription', schedule: '*/2 * * * *' },
      { name: 'podcast-transcription', schedule: '*/5 * * * *' },
      { name: 'tiktok-transcription', schedule: '*/2 * * * *' },
      { name: 'instagram-transcription', schedule: '*/2 * * * *' },
      { name: 'quiz-generation', schedule: '*/2 * * * *' },
      { name: 'reminder', schedule: '*/5 * * * *' },
      { name: 'auto-tagging', schedule: '*/15 * * * *' },
      { name: 'theme-classification', schedule: '*/15 * * * *' },
      { name: 'embedding-generation', schedule: '*/5 * * * *' },
      { name: 'theme-progress', schedule: '0 * * * *' },
      { name: 'theme-recall', schedule: '*/30 * * * *' },
      { name: 'cleanup-job-executions', schedule: '0 3 * * *' },
      { name: 'inbox-auto-expiration', schedule: '15 3 * * *' },
    ],
  };
}
