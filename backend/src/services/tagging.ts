// Auto-Tagging Service (S014)
import { prisma } from '../config/database.js';
import { getLLMClient } from './llm.js';
import pLimit from 'p-limit';
import { llmLimiter } from '../utils/rateLimiter.js';

/**
 * Generate tags for content based on transcript
 */
export async function generateTags(
  transcript: string,
  title: string
): Promise<string[]> {
  try {
    const llm = getLLMClient();

    // Truncate transcript for API limits
    const maxLength = 4000;
    const truncatedTranscript = transcript.length > maxLength
      ? transcript.substring(0, maxLength) + '...'
      : transcript;

    const response = await llmLimiter(() => llm.chatCompletion({
      messages: [
        {
          role: 'system',
          content: `You are a content categorization expert. Generate 3-5 relevant tags for the given content.

Rules:
- Tags should be lowercase, single words or short phrases (2-3 words max)
- Tags should describe the main topics, themes, or categories
- Be specific but not too niche
- Good examples: "machine learning", "productivity", "history", "science", "programming", "health"
- Bad examples: "interesting", "good", "video", "episode"

Return ONLY a JSON array of strings, nothing else.
Example: ["machine learning", "python", "data science"]`,
        },
        {
          role: 'user',
          content: `Title: ${title}

Content:
${truncatedTranscript}

Generate 3-5 relevant tags for this content.`,
        },
      ],
      temperature: 0.3,
      maxTokens: 200,
      jsonMode: true,
    }));

    const content = response.content?.trim();
    if (!content) {
      console.error('[Tagging] Empty response from LLM');
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
      console.error('[Tagging] Failed to parse tags JSON:', content);
      return [];
    }
  } catch (error) {
    console.error('[Tagging] Error generating tags:', error);
    return [];
  }
}

/**
 * Auto-tag a content item
 */
export async function autoTagContent(contentId: string): Promise<string[]> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: { transcript: true, tags: true },
  });

  if (!content) {
    console.error('[Tagging] Content not found:', contentId);
    return [];
  }

  // Skip if already has tags
  if (content.tags.length > 0) {
    console.log('[Tagging] Content already has tags:', contentId);
    return content.tags.map(t => t.name);
  }

  if (!content.transcript) {
    console.log('[Tagging] No transcript available:', contentId);
    return [];
  }

  console.log('[Tagging] Generating tags for:', content.title);

  const tagNames = await generateTags(content.transcript.text, content.title);

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

  console.log('[Tagging] Added tags to content:', contentId, tagNames);

  return tagNames;
}

/**
 * Run auto-tagging worker for all content without tags
 */
export async function runAutoTaggingWorker(): Promise<void> {
  console.log('[Tagging Worker] Starting...');

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

    console.log(`[Tagging Worker] Found ${contentToTag.length} items to tag`);

    const limit = pLimit(5); // 5 concurrent tagging jobs

    const results = await Promise.allSettled(
      contentToTag.map(content =>
        limit(() => autoTagContent(content.id))
      )
    );

    const tagged = results.filter(r => r.status === 'fulfilled' && (r.value as string[]).length > 0).length;
    console.log(`[Tagging Worker] Completed: ${tagged}/${contentToTag.length} tagged`);
  } catch (error) {
    console.error('[Tagging Worker] Error:', error);
  }
}
