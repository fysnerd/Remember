import type { ActionHandler } from 'adminjs';
import { triggerJob } from '../workers/scheduler.js';
import { logger } from '../config/logger.js';

const log = logger.child({ component: 'admin-triggers' });

type JobName = Parameters<typeof triggerJob>[0];

function createTriggerAction(jobName: JobName, displayName: string) {
  return {
    actionType: 'resource' as const,
    component: false as const,
    guard: `Are you sure you want to trigger ${displayName}?`,
    handler: (async (_request: any, _response: any, _context: any) => {
      log.info({ job: jobName }, 'Manual trigger from admin panel');
      // Fire and forget - don't await long-running jobs
      triggerJob(jobName, 'MANUAL').catch(err =>
        log.error({ err, job: jobName }, 'Manual trigger failed')
      );
      return {
        notice: { message: `${displayName} triggered successfully`, type: 'success' },
        records: [],
      };
    }) as ActionHandler<any>,
  };
}

export const jobTriggerActions = {
  triggerYoutubeSync:             createTriggerAction('youtube', 'YouTube Sync'),
  triggerSpotifySync:             createTriggerAction('spotify', 'Spotify Sync'),
  triggerTiktokSync:              createTriggerAction('tiktok', 'TikTok Sync'),
  triggerInstagramSync:           createTriggerAction('instagram', 'Instagram Sync'),
  triggerYoutubeTranscription:    createTriggerAction('transcription', 'YouTube Transcription'),
  triggerPodcastTranscription:    createTriggerAction('podcast-transcription', 'Podcast Transcription'),
  triggerTiktokTranscription:     createTriggerAction('tiktok-transcription', 'TikTok Transcription'),
  triggerInstagramTranscription:  createTriggerAction('instagram-transcription', 'Instagram Transcription'),
  triggerQuizGeneration:          createTriggerAction('quiz-generation', 'Quiz Generation'),
  triggerReminder:                createTriggerAction('reminder', 'Reminder'),
  triggerAutoTagging:             createTriggerAction('auto-tagging', 'Auto-Tagging'),
  triggerThemeClassification:     createTriggerAction('theme-classification', 'Theme Classification'),
  triggerThemeBackfill:           createTriggerAction('theme-backfill', 'Theme Backfill'),
};
