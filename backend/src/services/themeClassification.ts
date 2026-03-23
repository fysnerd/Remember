// Theme Classification Service
// Two-stage worker: (A) Generate themes from tag clusters via LLM, (B) Classify content into themes
import { prisma } from '../config/database.js';
import { getLLMClient } from './llm.js';
import pLimit from 'p-limit';
import { llmLimiter } from '../utils/rateLimiter.js';
import { logger } from '../config/logger.js';
import { generateSlug } from '../utils/slug.js';
import { findBestImageForTheme } from './themeImageMatching.js';
import { getPromptLocale } from './promptLocale.js';
import { normalizeLanguage } from '../utils/language.js';

const log = logger.child({ service: 'theme-classification' });

// ============================================================================
// Constants
// ============================================================================

const MAX_THEMES_PER_USER = 25;
const MIN_TAGGED_CONTENT = 10;
const MIN_TAG_USAGE = 2;
const MIN_ORPHANS_FOR_EVOLUTION = 1;

const THEME_COLOR_PALETTE = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#14B8A6', '#3B82F6', '#6366F1', '#8B5CF6',
  '#EC4899', '#F43F5E', '#06B6D4', '#84CC16',
];

// ============================================================================
// Types
// ============================================================================

interface GeneratedTheme {
  name: string;
  emoji: string;
  description: string;
  color: string;
  tags: string[];
}

// ============================================================================
// Main Worker Entry Point
// ============================================================================

/**
 * Main worker entry point (called by scheduler).
 * Stage A: Generate themes for users with 10+ tagged items but 0 themes.
 * Stage B: Classify unthemed content for users who already have themes.
 * Stage C: Evolve themes for users with orphan content that doesn't fit existing themes.
 */
export async function runThemeClassificationWorker(): Promise<void> {
  log.info('Theme classification worker starting');

  try {
    // Stage A: Generate themes for eligible users without themes
    const usersNeedingThemes = await prisma.user.findMany({
      where: {
        themes: { none: {} },
        contents: {
          some: {
            tags: { some: {} },
          },
        },
      },
      select: { id: true, language: true },
    });

    // Filter to users with MIN_TAGGED_CONTENT+ tagged content items
    const eligibleUsers: { id: string; language: string }[] = [];
    for (const user of usersNeedingThemes) {
      const taggedCount = await prisma.content.count({
        where: { userId: user.id, tags: { some: {} } },
      });
      if (taggedCount >= MIN_TAGGED_CONTENT) {
        eligibleUsers.push(user);
      }
    }

    if (eligibleUsers.length > 0) {
      log.info({ count: eligibleUsers.length }, 'Generating themes for new users');
      const userLimit = pLimit(3);
      await Promise.allSettled(
        eligibleUsers.map(user => userLimit(() => generateThemesForUser(user.id, normalizeLanguage(user.language))))
      );
    }

    // Stage B: Classify unthemed content for users with existing themes
    const unclassifiedContent = await prisma.content.findMany({
      where: {
        tags: { some: {} },
        contentThemes: { none: {} },
        user: { themes: { some: {} } },
      },
      take: 20,
      orderBy: { createdAt: 'asc' },
      select: { id: true, userId: true },
    });

    if (unclassifiedContent.length > 0) {
      // Look up user languages for classification
      const classifyUserIds = [...new Set(unclassifiedContent.map(c => c.userId))];
      const classifyUsers = await prisma.user.findMany({
        where: { id: { in: classifyUserIds } },
        select: { id: true, language: true },
      });
      const classifyLangMap = new Map(classifyUsers.map(u => [u.id, normalizeLanguage(u.language)]));

      log.info({ count: unclassifiedContent.length }, 'Classifying unthemed content');
      const classifyLimit = pLimit(5);
      await Promise.allSettled(
        unclassifiedContent.map(c =>
          classifyLimit(() => classifyContentForUser(c.id, c.userId, classifyLangMap.get(c.userId) || 'fr'))
        )
      );
    }

    // Stage C: Evolve themes for users with orphan content
    // Find users who have themes but still have unthemed tagged content after Stage B
    const usersWithOrphans = await prisma.$queryRaw<{ userId: string; orphanCount: bigint }[]>`
      SELECT c."userId", COUNT(*) as "orphanCount"
      FROM "Content" c
      WHERE c.status IN ('SELECTED', 'READY')
        AND EXISTS (SELECT 1 FROM "_ContentTags" ct WHERE ct."A" = c.id)
        AND NOT EXISTS (SELECT 1 FROM "ContentTheme" cth WHERE cth."contentId" = c.id)
        AND EXISTS (SELECT 1 FROM "Theme" t WHERE t."userId" = c."userId")
      GROUP BY c."userId"
      HAVING COUNT(*) >= ${MIN_ORPHANS_FOR_EVOLUTION}
    `;

    if (usersWithOrphans.length > 0) {
      // Look up user languages for evolution
      const evolveUserIds = usersWithOrphans.map(u => u.userId);
      const evolveUsers = await prisma.user.findMany({
        where: { id: { in: evolveUserIds } },
        select: { id: true, language: true },
      });
      const evolveLangMap = new Map(evolveUsers.map(u => [u.id, normalizeLanguage(u.language)]));

      log.info({ count: usersWithOrphans.length }, 'Evolving themes for users with orphan content');
      const evolveLimit = pLimit(2);
      await Promise.allSettled(
        usersWithOrphans.map(u => evolveLimit(() => evolveThemesForUser(u.userId, evolveLangMap.get(u.userId) || 'fr')))
      );
    }

    log.info('Theme classification worker completed');
  } catch (error) {
    log.error({ err: error }, 'Theme classification worker error');
  }
}

// ============================================================================
// Theme Generation
// ============================================================================

/**
 * Generate themes for a user by clustering their tags via LLM.
 * Idempotent: skips if user already has themes.
 */
export async function generateThemesForUser(userId: string, language: string = 'fr'): Promise<void> {
  // Check idempotency: skip if user already has themes
  const existingThemeCount = await prisma.theme.count({ where: { userId } });
  if (existingThemeCount > 0) {
    log.debug({ userId }, 'User already has themes, skipping generation');
    return;
  }

  // Query user's tags with usage counts via raw SQL for aggregation
  const userTags = await prisma.$queryRaw<{ id: string; name: string; count: bigint }[]>`
    SELECT t.id, t.name, COUNT(ct."B") as count
    FROM "Tag" t
    JOIN "_ContentTags" ct ON ct."B" = t.id
    JOIN "Content" c ON c.id = ct."A"
    WHERE c."userId" = ${userId}
    GROUP BY t.id, t.name
    ORDER BY count DESC
  `;

  // Filter to tags with usage >= MIN_TAG_USAGE (drop single-use noise)
  const filteredTags = userTags.filter(t => Number(t.count) >= MIN_TAG_USAGE);

  // Fallback: if not enough high-usage tags, use ALL tags and let the LLM cluster them
  let tagList: { name: string; count: number }[];
  if (filteredTags.length >= 5) {
    tagList = filteredTags.map(t => ({ name: t.name, count: Number(t.count) }));
  } else if (userTags.length >= 5) {
    log.info({ userId, filteredCount: filteredTags.length, totalCount: userTags.length }, 'Not enough high-usage tags, falling back to all tags');
    tagList = userTags.map(t => ({ name: t.name, count: Number(t.count) }));
  } else {
    log.debug({ userId, tagCount: userTags.length }, 'Not enough tags for theme generation');
    return;
  }

  // Call LLM to cluster tags into themes
  const generatedThemes = await generateThemesFromTags(tagList, [], language);

  if (generatedThemes.length === 0) {
    log.warn({ userId }, 'LLM returned no themes');
    return;
  }

  // Enforce MAX_THEMES cap
  const cappedThemes = generatedThemes.slice(0, MAX_THEMES_PER_USER);

  log.info({ userId, themeCount: cappedThemes.length }, 'Creating themes from LLM output');

  // Create themes + ThemeTag records in a transaction for atomicity
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < cappedThemes.length; i++) {
      const generated = cappedThemes[i];
      const slug = generateSlug(generated.name);

      // Skip if slug is empty (bad name from LLM)
      if (!slug) continue;

      // Check slug uniqueness within this user's themes (defensive)
      const existingSlug = await tx.theme.findUnique({
        where: { userId_slug: { userId, slug } },
      });
      if (existingSlug) continue;

      // Validate color is from palette, fallback to palette color by index
      const color = THEME_COLOR_PALETTE.includes(generated.color)
        ? generated.color
        : THEME_COLOR_PALETTE[i % THEME_COLOR_PALETTE.length];

      const emoji = generated.emoji || '\u{1F4DA}'; // Default: books emoji

      // Find best matching pre-generated image
      const imageUrl = await findBestImageForTheme(generated.name, generated.tags || []);

      // Create the theme
      const theme = await tx.theme.create({
        data: {
          userId,
          name: generated.name,
          slug,
          color,
          emoji,
          imageUrl,
          description: generated.description || null,
          discoveredAt: new Date(),
        },
      });

      // Create ThemeTag links for the tags associated with this theme
      if (generated.tags && generated.tags.length > 0) {
        // Find matching Tag records by name (case-insensitive matching)
        const matchingTags = await tx.tag.findMany({
          where: {
            name: { in: generated.tags.map(t => t.toLowerCase().trim()) },
          },
          select: { id: true },
        });

        if (matchingTags.length > 0) {
          await tx.themeTag.createMany({
            data: matchingTags.map(tag => ({
              themeId: theme.id,
              tagId: tag.id,
            })),
            skipDuplicates: true,
          });
        }
      }
    }
  });

  // After creating themes, classify all existing tagged content for this user
  await classifyAllContentForUser(userId, language);

  log.info({ userId }, 'Theme generation and initial classification complete');
}

// ============================================================================
// Content Classification
// ============================================================================

/**
 * Classify a single content item into 1-3 matching themes.
 * Uses deterministic tag matching first, LLM fallback if no match.
 */
export async function classifyContentForUser(contentId: string, userId: string, language: string = 'fr'): Promise<void> {
  try {
    // Load content with its tags
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: {
        tags: { select: { id: true, name: true } },
      },
    });

    if (!content || content.tags.length === 0) {
      return;
    }

    // Load user's themes with their associated tags
    const userThemes = await prisma.theme.findMany({
      where: { userId },
      include: {
        themeTags: {
          include: {
            tag: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (userThemes.length === 0) {
      return;
    }

    const contentTagIds = new Set(content.tags.map(t => t.id));

    // Deterministic matching: check if content's tags overlap with theme's ThemeTag tagIds
    const matchedThemeIds: string[] = [];
    for (const theme of userThemes) {
      const themeTagIds = theme.themeTags.map(tt => tt.tag.id);
      const hasOverlap = themeTagIds.some(tagId => contentTagIds.has(tagId));
      if (hasOverlap) {
        matchedThemeIds.push(theme.id);
      }
    }

    if (matchedThemeIds.length > 0) {
      // Use deterministic matches (cap at 3)
      const finalThemeIds = matchedThemeIds.slice(0, 3);
      await prisma.contentTheme.createMany({
        data: finalThemeIds.map(themeId => ({
          contentId,
          themeId,
          assignedBy: 'system',
        })),
        skipDuplicates: true,
      });
      return;
    }

    // LLM fallback: no deterministic match found
    const contentTagNames = content.tags.map(t => t.name);
    const themesForLLM = userThemes.map(t => ({
      id: t.id,
      name: t.name,
      tags: t.themeTags.map(tt => tt.tag.name),
    }));

    const matchedNames = await classifyContentViaLLM(
      content.title,
      contentTagNames,
      themesForLLM,
      language
    );

    if (matchedNames.length > 0) {
      // Map theme names back to IDs
      const nameToId = new Map(userThemes.map(t => [t.name.toLowerCase(), t.id]));
      const resolvedIds = matchedNames
        .map(name => nameToId.get(name.toLowerCase()))
        .filter((id): id is string => id !== undefined)
        .slice(0, 3);

      if (resolvedIds.length > 0) {
        await prisma.contentTheme.createMany({
          data: resolvedIds.map(themeId => ({
            contentId,
            themeId,
            assignedBy: 'system',
          })),
          skipDuplicates: true,
        });
      }
    }
  } catch (error) {
    log.error({ err: error, contentId, userId }, 'Error classifying content');
  }
}

// ============================================================================
// Backfill
// ============================================================================

/**
 * One-time backfill: generate themes and classify content for all eligible users.
 * Uses lower concurrency (pLimit(2)) to be gentle on LLM API.
 */
export async function runBackfillThemes(): Promise<void> {
  log.info('Theme backfill starting');

  try {
    // Get all users with tagged content
    const users = await prisma.user.findMany({
      where: {
        contents: {
          some: { tags: { some: {} } },
        },
      },
      select: { id: true, language: true },
    });

    const backfillLimit = pLimit(2);
    await Promise.allSettled(
      users.map(user => backfillLimit(async () => {
        const lang = normalizeLanguage(user.language);
        const taggedCount = await prisma.content.count({
          where: { userId: user.id, tags: { some: {} } },
        });

        if (taggedCount < MIN_TAGGED_CONTENT) {
          log.debug({ userId: user.id, taggedCount }, 'User below threshold, skipping backfill');
          return;
        }

        // Generate themes if user has none
        const themeCount = await prisma.theme.count({ where: { userId: user.id } });
        if (themeCount === 0) {
          await generateThemesForUser(user.id, lang);
        }

        // Classify all tagged content without theme assignments
        await classifyAllContentForUser(user.id, lang);
      }))
    );

    log.info('Theme backfill completed');
  } catch (error) {
    log.error({ err: error }, 'Theme backfill error');
  }
}

// ============================================================================
// Internal Helpers (not exported)
// ============================================================================

/** Extract only the first emoji from a string, fallback to books emoji. */
function extractFirstEmoji(str: string): string {
  const match = str.match(/\p{Extended_Pictographic}/u);
  return match ? match[0] : '\u{1F4DA}';
}

/**
 * Call LLM to cluster user's tags into coherent themes.
 * Prompt in French, requests 5-15 themes with emoji and color from fixed palette.
 */
async function generateThemesFromTags(
  userTags: { name: string; count: number }[],
  existingThemes: { name: string; slug: string }[],
  language: string = 'fr'
): Promise<GeneratedTheme[]> {
  try {
    const llm = getLLMClient();
    const locale = getPromptLocale(language);

    // Format tags with usage counts, sorted by frequency
    const countLabel = locale.contentCountLabel;
    const tagList = userTags
      .sort((a, b) => b.count - a.count)
      .map(t => `- "${t.name}" (${t.count} ${countLabel})`)
      .join('\n');

    const existingList = existingThemes.length > 0
      ? (language === 'en'
          ? `\n\nEXISTING themes (DO NOT create duplicates or variants):\n${existingThemes.map(t => `- "${t.name}"`).join('\n')}`
          : `\n\nThemes EXISTANTS (NE PAS creer de doublons ni de variantes):\n${existingThemes.map(t => `- "${t.name}"`).join('\n')}`)
      : '';

    const response = await llmLimiter(() => llm.chatCompletion({
      messages: [
        {
          role: 'system',
          content: locale.themeGenerationSystemPrompt,
        },
        {
          role: 'user',
          content: locale.themeGenerationUserPrompt(tagList, existingList),
        },
      ],
      temperature: 0.3,
      maxTokens: 2000,
      jsonMode: true,
    }));

    const content = response.content?.trim();
    if (!content) {
      log.error('Empty response from LLM for theme generation');
      return [];
    }

    // Parse and validate JSON response
    try {
      const parsed = JSON.parse(content);
      if (!parsed.themes || !Array.isArray(parsed.themes)) {
        log.error({ content }, 'Invalid theme generation response structure');
        return [];
      }

      return parsed.themes
        .filter(
          (t: any) =>
            t.name &&
            typeof t.name === 'string' &&
            t.tags &&
            Array.isArray(t.tags)
        )
        .map((t: any) => ({
          name: String(t.name).trim(),
          emoji: extractFirstEmoji(typeof t.emoji === 'string' ? t.emoji : ''),
          description: typeof t.description === 'string' ? String(t.description).trim() : '',
          color: typeof t.color === 'string' ? t.color : '#6366F1',
          tags: t.tags.filter((tag: any) => typeof tag === 'string'),
        }));
    } catch {
      log.error({ content }, 'Failed to parse theme generation JSON');
      return [];
    }
  } catch (error) {
    log.error({ err: error }, 'Error generating themes from tags');
    return [];
  }
}

/**
 * LLM fallback for content classification when deterministic tag matching fails.
 * Lighter call: asks which 1-3 existing themes match this content.
 */
async function classifyContentViaLLM(
  contentTitle: string,
  contentTags: string[],
  existingThemes: { id: string; name: string; tags: string[] }[],
  language: string = 'fr'
): Promise<string[]> {
  try {
    const llm = getLLMClient();
    const locale = getPromptLocale(language);

    const themeList = existingThemes
      .map(t => `- "${t.name}" (tags: ${t.tags.join(', ')})`)
      .join('\n');

    const response = await llmLimiter(() => llm.chatCompletion({
      messages: [
        {
          role: 'system',
          content: locale.themeClassificationSystemPrompt,
        },
        {
          role: 'user',
          content: locale.themeClassificationUserPrompt(contentTitle, contentTags.join(', '), themeList),
        },
      ],
      temperature: 0.2,
      maxTokens: 200,
      jsonMode: true,
    }));

    try {
      const parsed = JSON.parse(response.content?.trim() || '{}');
      return Array.isArray(parsed.themeNames) ? parsed.themeNames : [];
    } catch {
      log.error({ content: response.content }, 'Failed to parse classification JSON');
      return [];
    }
  } catch (error) {
    log.error({ err: error, contentTitle }, 'Error classifying content via LLM');
    return [];
  }
}

// ============================================================================
// Theme Evolution (create new themes from orphan content)
// ============================================================================

/**
 * Detect unthemed tagged content and create new themes if enough orphans accumulate.
 * Only runs for users who already have themes (initial generation is handled by generateThemesForUser).
 * Reuses generateThemesFromTags with existing themes passed to avoid duplicates.
 */
export async function evolveThemesForUser(userId: string, language: string = 'fr'): Promise<void> {
  try {
    // Only evolve for users who already have themes
    const existingThemes = await prisma.theme.findMany({
      where: { userId },
      select: { id: true, name: true, slug: true },
    });

    if (existingThemes.length === 0) {
      // No themes yet — generateThemesForUser handles initial creation
      return;
    }

    if (existingThemes.length >= MAX_THEMES_PER_USER) {
      return;
    }

    // Find tagged content without any theme assignment (SELECTED or READY)
    const orphanContent = await prisma.content.findMany({
      where: {
        userId,
        status: { in: ['SELECTED', 'READY'] },
        tags: { some: {} },
        contentThemes: { none: {} },
      },
      include: {
        tags: { select: { id: true, name: true } },
      },
    });

    if (orphanContent.length < MIN_ORPHANS_FOR_EVOLUTION) {
      return;
    }

    // Collect orphan tag frequencies
    const tagCounts = new Map<string, number>();
    for (const content of orphanContent) {
      for (const tag of content.tags) {
        tagCounts.set(tag.name, (tagCounts.get(tag.name) || 0) + 1);
      }
    }

    const orphanTags = Array.from(tagCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    if (orphanTags.length === 0) {
      return;
    }

    log.info({ userId, orphanCount: orphanContent.length, tagCount: orphanTags.length }, 'Evolving themes from orphan content');

    // Ask LLM to suggest new themes, passing existing themes to avoid duplicates
    const newThemes = await generateThemesFromTags(orphanTags, existingThemes, language);

    if (newThemes.length === 0) {
      log.debug({ userId }, 'LLM returned no new themes for evolution');
      return;
    }

    // Cap to available slots
    const availableSlots = MAX_THEMES_PER_USER - existingThemes.length;
    const cappedThemes = newThemes.slice(0, availableSlots);

    // Create new themes + ThemeTag records
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < cappedThemes.length; i++) {
        const generated = cappedThemes[i];
        const slug = generateSlug(generated.name);
        if (!slug) continue;

        const existingSlug = await tx.theme.findUnique({
          where: { userId_slug: { userId, slug } },
        });
        if (existingSlug) continue;

        const color = THEME_COLOR_PALETTE.includes(generated.color)
          ? generated.color
          : THEME_COLOR_PALETTE[(existingThemes.length + i) % THEME_COLOR_PALETTE.length];

        const emoji = generated.emoji || '\u{1F4DA}';

        const evolveImageUrl = await findBestImageForTheme(generated.name, generated.tags || []);

        const theme = await tx.theme.create({
          data: { userId, name: generated.name, slug, color, emoji, imageUrl: evolveImageUrl, description: generated.description || null, discoveredAt: new Date() },
        });

        if (generated.tags?.length > 0) {
          const matchingTags = await tx.tag.findMany({
            where: { name: { in: generated.tags.map(t => t.toLowerCase().trim()) } },
            select: { id: true },
          });

          if (matchingTags.length > 0) {
            await tx.themeTag.createMany({
              data: matchingTags.map(tag => ({ themeId: theme.id, tagId: tag.id })),
              skipDuplicates: true,
            });
          }
        }
      }
    });

    // Classify orphan content with new themes available
    const classifyLimit = pLimit(5);
    await Promise.allSettled(
      orphanContent.map(c => classifyLimit(() => classifyContentForUser(c.id, userId, language)))
    );

    log.info({ userId, newThemeCount: cappedThemes.length, orphanCount: orphanContent.length }, 'Theme evolution complete');
  } catch (error) {
    log.error({ err: error, userId }, 'Error evolving themes for user');
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Classify all tagged content without theme assignments for a given user.
 */
async function classifyAllContentForUser(userId: string, language: string = 'fr'): Promise<void> {
  const unthemed = await prisma.content.findMany({
    where: {
      userId,
      tags: { some: {} },
      contentThemes: { none: {} },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (unthemed.length === 0) {
    return;
  }

  log.info({ userId, count: unthemed.length }, 'Classifying all unthemed content for user');

  const classifyLimit = pLimit(5);
  await Promise.allSettled(
    unthemed.map(c => classifyLimit(() => classifyContentForUser(c.id, userId, language)))
  );
}
