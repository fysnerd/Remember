// Embedding Generation Service
// Generates vector embeddings for TranscriptCache entries using Mistral Embed
import { prisma } from '../config/database.js';
import { generateEmbeddingsBatch } from './llm.js';
import { llmLimiter } from '../utils/rateLimiter.js';
import { logger } from '../config/logger.js';

const log = logger.child({ service: 'embedding-generation' });

const MAX_TEXT_CHARS = 8000;
const WORKER_BATCH_SIZE = 20;
const API_BATCH_SIZE = 10;
const BACKFILL_BATCH_SIZE = 50;

/**
 * Prepare embedding input: title + truncated transcript text
 */
function prepareEmbeddingInput(title: string, text: string): string {
  const truncated = text.slice(0, MAX_TEXT_CHARS);
  return `${title}\n\n${truncated}`;
}

/**
 * Process a batch of TranscriptCache entries: generate embeddings via API batch call and store them
 */
async function processBatch(entries: { id: string; title: string; text: string }[]): Promise<number> {
  if (entries.length === 0) return 0;

  const inputs = entries.map(e => prepareEmbeddingInput(e.title, e.text));
  const embeddings = await llmLimiter(() => generateEmbeddingsBatch(inputs));

  let stored = 0;
  for (let i = 0; i < entries.length; i++) {
    const vector = JSON.stringify(embeddings[i]);
    await prisma.$executeRaw`
      UPDATE "TranscriptCache"
      SET embedding = ${vector}::vector
      WHERE id = ${entries[i].id}
    `;
    stored++;
  }

  return stored;
}

/**
 * Fetch titles for a list of TranscriptCache IDs by joining through Content
 */
async function getTitleMap(tcIds: string[]): Promise<Map<string, string>> {
  const results = await prisma.$queryRaw<{ tcId: string; title: string }[]>`
    SELECT DISTINCT ON (c."transcriptCacheId")
      c."transcriptCacheId" as "tcId", c.title
    FROM "Content" c
    WHERE c."transcriptCacheId" = ANY(${tcIds}::text[])
    ORDER BY c."transcriptCacheId", c."createdAt" DESC
  `;
  return new Map(results.map(r => [r.tcId, r.title]));
}

/**
 * Worker: process up to WORKER_BATCH_SIZE TranscriptCache entries without embeddings.
 * Called by scheduler every 5 minutes.
 */
export async function runEmbeddingWorker(): Promise<void> {
  log.info('Embedding generation worker starting');

  try {
    const pending = await prisma.$queryRaw<{ id: string; text: string }[]>`
      SELECT tc.id, tc.text
      FROM "TranscriptCache" tc
      WHERE tc.embedding IS NULL
        AND tc.text IS NOT NULL
        AND length(tc.text) > 50
      ORDER BY tc."createdAt" DESC
      LIMIT ${WORKER_BATCH_SIZE}
    `;

    if (pending.length === 0) {
      log.info('No pending transcript caches for embedding generation');
      return;
    }

    log.info({ count: pending.length }, 'Found transcript caches needing embeddings');

    // Get titles from Content table via transcriptCacheId
    const tcIds = pending.map(p => p.id);
    const titleMap = await getTitleMap(tcIds);

    // Process in batches of API_BATCH_SIZE
    let totalProcessed = 0;
    for (let i = 0; i < pending.length; i += API_BATCH_SIZE) {
      const batch = pending.slice(i, i + API_BATCH_SIZE).map(p => ({
        id: p.id,
        title: titleMap.get(p.id) || '',
        text: p.text,
      }));

      try {
        const processed = await processBatch(batch);
        totalProcessed += processed;
      } catch (error) {
        log.error({ err: error, batchStart: i }, 'Failed to process embedding batch');
      }
    }

    log.info({ processed: totalProcessed, total: pending.length }, 'Embedding generation worker completed');
  } catch (error) {
    log.error({ err: error }, 'Embedding generation worker failed');
    throw error;
  }
}

/**
 * Backfill: process ALL TranscriptCache entries without embeddings.
 * Runs in larger batches. Called manually via admin endpoint.
 */
export async function runEmbeddingBackfill(): Promise<void> {
  log.info('Embedding backfill starting');

  let totalProcessed = 0;
  let hasMore = true;

  while (hasMore) {
    const pending = await prisma.$queryRaw<{ id: string; text: string }[]>`
      SELECT tc.id, tc.text
      FROM "TranscriptCache" tc
      WHERE tc.embedding IS NULL
        AND tc.text IS NOT NULL
        AND length(tc.text) > 50
      ORDER BY tc."createdAt" DESC
      LIMIT ${BACKFILL_BATCH_SIZE}
    `;

    if (pending.length === 0) {
      hasMore = false;
      break;
    }

    // Get titles
    const tcIds = pending.map(p => p.id);
    const titleMap = await getTitleMap(tcIds);

    // Process in batches of API_BATCH_SIZE
    for (let i = 0; i < pending.length; i += API_BATCH_SIZE) {
      const batch = pending.slice(i, i + API_BATCH_SIZE).map(p => ({
        id: p.id,
        title: titleMap.get(p.id) || '',
        text: p.text,
      }));

      try {
        const processed = await processBatch(batch);
        totalProcessed += processed;
      } catch (error) {
        log.error({ err: error, batchStart: i }, 'Failed to process backfill batch');
      }
    }

    log.info({ processed: totalProcessed }, 'Backfill progress');

    if (pending.length < BACKFILL_BATCH_SIZE) {
      hasMore = false;
    }
  }

  log.info({ totalProcessed }, 'Embedding backfill completed');
}
