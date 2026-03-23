// Auto-Tagging Service (S014)
import { prisma } from '../config/database.js';
import { getLLMClient } from './llm.js';
import pLimit from 'p-limit';
import { llmLimiter } from '../utils/rateLimiter.js';
import { logger } from '../config/logger.js';
import { getPromptLocale } from './promptLocale.js';
import { normalizeLanguage } from '../utils/language.js';

const log = logger.child({ service: 'auto-tagging' });

/**
 * Generate tags for content based on transcript
 */
export async function generateTags(
  transcript: string,
  title: string,
  language: string = 'fr'
): Promise<string[]> {
  try {
    const llm = getLLMClient();
    const locale = getPromptLocale(language);

    // Truncate transcript for API limits
    const maxLength = 4000;
    const truncatedTranscript = transcript.length > maxLength
      ? transcript.substring(0, maxLength) + '...'
      : transcript;

    const response = await llmLimiter(() => llm.chatCompletion({
      messages: [
        {
          role: 'system',
          content: locale.tagInstruction,
        },
        {
          role: 'user',
          content: locale.tagUserPrompt(title, truncatedTranscript),
        },
      ],
      temperature: 0.2,
      maxTokens: 200,
      jsonMode: true,
    }));

    const content = response.content?.trim();
    if (!content) {
      log.error('Empty response from LLM');
      return [];
    }

    // Parse JSON response
    try {
      const tags = JSON.parse(content) as string[];
      if (!Array.isArray(tags)) {
        return [];
      }
      // Clean and validate tags
      return tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map(tag => tag.toLowerCase().trim())
        .filter(tag => tag.length > 0 && tag.length <= 50)
        .slice(0, 5);
    } catch {
      log.error({ content }, 'Failed to parse tags JSON');
      return [];
    }
  } catch (error) {
    log.error({ err: error }, 'Error generating tags');
    return [];
  }
}

/**
 * Auto-tag a content item
 */
export async function autoTagContent(contentId: string, language: string = 'fr'): Promise<string[]> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: { transcript: true, tags: true },
  });

  if (!content) {
    log.error({ contentId }, 'Content not found');
    return [];
  }

  // Skip if already has tags
  if (content.tags.length > 0) {
    log.debug({ contentId }, 'Content already has tags');
    return content.tags.map(t => t.name);
  }

  if (!content.transcript) {
    log.debug({ contentId }, 'No transcript available');
    return [];
  }

  log.info({ contentId, title: content.title }, 'Generating tags');

  const tagNames = await generateTags(content.transcript.text, content.title, language);

  if (tagNames.length === 0) {
    return [];
  }

  // Create or find tags and connect them to content
  const tags = await Promise.all(
    tagNames.map(async (name) => {
      return prisma.tag.upsert({
        where: { name },
        create: { name },
        update: {},
      });
    })
  );

  // Connect tags to content
  await prisma.content.update({
    where: { id: contentId },
    data: {
      tags: {
        connect: tags.map(t => ({ id: t.id })),
      },
    },
  });

  log.info({ contentId, tagCount: tagNames.length, tags: tagNames }, 'Tags applied to content');

  return tagNames;
}

/**
 * Run auto-tagging worker for all content without tags
 */
export async function runAutoTaggingWorker(): Promise<void> {
  log.info('Auto-tagging worker starting');

  try {
    // Find content with transcripts but no tags
    const contentToTag = await prisma.content.findMany({
      where: {
        transcript: { isNot: null },
        tags: { none: {} },
        status: 'READY',
      },
      take: 10, // Process 10 at a time
      orderBy: { createdAt: 'asc' },
    });

    log.info({ count: contentToTag.length }, 'Found items to tag');

    // Look up user language for each content item
    const tagUserIds = [...new Set(contentToTag.map(c => c.userId))];
    const tagUsers = await prisma.user.findMany({
      where: { id: { in: tagUserIds } },
      select: { id: true, language: true },
    });
    const tagUserLangMap = new Map(tagUsers.map(u => [u.id, normalizeLanguage(u.language)]));

    const limit = pLimit(5); // 5 concurrent tagging jobs

    const results = await Promise.allSettled(
      contentToTag.map(content =>
        limit(() => autoTagContent(content.id, tagUserLangMap.get(content.userId) || 'fr'))
      )
    );

    const tagged = results.filter(r => r.status === 'fulfilled' && (r.value as string[]).length > 0).length;
    log.info({ tagged, total: contentToTag.length }, 'Auto-tagging worker completed');
  } catch (error) {
    log.error({ err: error }, 'Auto-tagging worker error');
  }
}
