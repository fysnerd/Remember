import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../config/logger.js';
import { Platform } from '@prisma/client';
import { z } from 'zod';
import { generateSlug } from '../utils/slug.js';
import { generateText } from '../services/llm.js';

const log = logger.child({ route: 'themes' });
export const themeRouter = Router();
themeRouter.use(authenticateToken);

const MAX_THEMES_PER_USER = 25;
const MEMO_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// Zod Validation Schemas
// ============================================================================

const createThemeSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  emoji: z.string().max(4).optional(),
});

const updateThemeSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  emoji: z.string().max(4).optional(),
});

const addContentSchema = z.object({
  contentIds: z.array(z.string()).min(1).max(100),
});

// ============================================================================
// GET / -- List user's themes with content counts
// ============================================================================

themeRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const themes = await prisma.theme.findMany({
      where: { userId },
      include: {
        _count: {
          select: { contentThemes: true },
        },
        themeTags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = themes.map(({ _count, themeTags, ...theme }) => ({
      ...theme,
      contentCount: _count.contentThemes,
      tags: themeTags.map((tt) => ({ id: tt.tag.id, name: tt.tag.name })),
    }));

    return res.json({ themes: result });
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// GET /:id -- Theme detail with paginated content
// ============================================================================

themeRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const themeId = req.params.id as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const platform = req.query.platform as string | undefined;

    // Verify theme ownership
    const theme = await prisma.theme.findFirst({
      where: { id: themeId, userId },
      include: {
        _count: {
          select: { contentThemes: true },
        },
        themeTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Build content query through join table
    const contentWhere: any = {
      contentThemes: { some: { themeId } },
      userId,
    };

    // Optional platform filter
    if (platform && ['YOUTUBE', 'SPOTIFY', 'TIKTOK', 'INSTAGRAM'].includes(platform)) {
      contentWhere.platform = platform as Platform;
    }

    const [contents, total, quizReadyCount] = await Promise.all([
      prisma.content.findMany({
        where: contentWhere,
        orderBy: { capturedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          tags: true,
          _count: {
            select: { quizzes: true },
          },
        },
      }),
      prisma.content.count({ where: contentWhere }),
      prisma.content.count({
        where: {
          userId,
          contentThemes: { some: { themeId } },
          status: 'READY',
          quizzes: { some: {} },
        },
      }),
    ]);

    const { _count, themeTags, ...themeData } = theme;

    return res.json({
      theme: {
        ...themeData,
        contentCount: _count.contentThemes,
        quizReadyCount,
        canQuiz: quizReadyCount >= 3,
        tags: themeTags.map((tt) => ({ id: tt.tag.id, name: tt.tag.name })),
      },
      contents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// POST / -- Create theme
// ============================================================================

themeRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const data = createThemeSchema.parse(req.body);

    // Check theme cap
    const themeCount = await prisma.theme.count({ where: { userId } });
    if (themeCount >= MAX_THEMES_PER_USER) {
      return res.status(400).json({
        error: `Maximum ${MAX_THEMES_PER_USER} themes per user reached`,
      });
    }

    // Generate slug from name
    const slug = generateSlug(data.name);

    // Check slug uniqueness for user
    const existing = await prisma.theme.findUnique({
      where: { userId_slug: { userId, slug } },
    });
    if (existing) {
      return res.status(409).json({
        error: 'A theme with a similar name already exists',
      });
    }

    const theme = await prisma.theme.create({
      data: {
        userId,
        name: data.name,
        slug,
        ...(data.color && { color: data.color }),
        ...(data.emoji && { emoji: data.emoji }),
      },
    });

    log.info({ userId, themeId: theme.id, name: theme.name }, 'Theme created');

    return res.status(201).json(theme);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    return next(error);
  }
});

// ============================================================================
// PUT /:id -- Update theme
// ============================================================================

themeRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const themeId = req.params.id as string;
    const data = updateThemeSchema.parse(req.body);

    // Verify ownership
    const theme = await prisma.theme.findFirst({
      where: { id: themeId, userId },
    });

    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Build update data
    const updateData: any = {};
    if (data.name !== undefined) {
      updateData.name = data.name;
      // Regenerate slug if name changed
      const newSlug = generateSlug(data.name);
      // Check slug uniqueness (exclude current theme)
      const existing = await prisma.theme.findFirst({
        where: {
          userId,
          slug: newSlug,
          id: { not: themeId },
        },
      });
      if (existing) {
        return res.status(409).json({
          error: 'A theme with a similar name already exists',
        });
      }
      updateData.slug = newSlug;
    }
    if (data.color !== undefined) updateData.color = data.color;
    if (data.emoji !== undefined) updateData.emoji = data.emoji;

    const updated = await prisma.theme.update({
      where: { id: themeId },
      data: updateData,
    });

    return res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    return next(error);
  }
});

// ============================================================================
// DELETE /:id -- Delete theme (preserves content)
// ============================================================================

themeRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const themeId = req.params.id as string;

    // Verify ownership
    const theme = await prisma.theme.findFirst({
      where: { id: themeId, userId },
    });

    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Delete theme -- cascade removes ContentTheme and ThemeTag join records,
    // but NOT the Content or Tag records themselves
    await prisma.theme.delete({
      where: { id: themeId },
    });

    log.info({ userId, themeId, name: theme.name }, 'Theme deleted');

    return res.json({ message: 'Theme deleted successfully' });
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// POST /:id/content -- Add content items to theme
// ============================================================================

themeRouter.post('/:id/content', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const themeId = req.params.id as string;
    const data = addContentSchema.parse(req.body);

    // Verify theme ownership
    const theme = await prisma.theme.findFirst({
      where: { id: themeId, userId },
    });

    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Verify content ownership
    const ownedContent = await prisma.content.findMany({
      where: {
        id: { in: data.contentIds },
        userId,
      },
      select: { id: true },
    });

    if (ownedContent.length === 0) {
      return res.status(404).json({ error: 'No valid content found' });
    }

    // Create join records (skip duplicates)
    const result = await prisma.contentTheme.createMany({
      data: ownedContent.map((c) => ({
        contentId: c.id,
        themeId,
        assignedBy: 'user',
      })),
      skipDuplicates: true,
    });

    // Clear cached memo so next view triggers fresh generation
    await prisma.theme.update({
      where: { id: themeId },
      data: { memo: null, memoGeneratedAt: null },
    });

    // Delete synthesis quizzes for this theme (they reference old content combinations)
    // Cascade: deleting Quiz also deletes Card and Review via onDelete: Cascade
    await prisma.quiz.deleteMany({
      where: { themeId, isSynthesis: true },
    });
    log.info({ themeId, action: 'synthesis-invalidated' }, 'Synthesis quizzes cleared on content change');

    log.info({ userId, themeId, added: result.count }, 'Content added to theme');

    return res.json({
      message: `Added ${result.count} content item(s) to theme`,
      added: result.count,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    return next(error);
  }
});

// ============================================================================
// DELETE /:id/content/:contentId -- Remove content from theme
// ============================================================================

themeRouter.delete('/:id/content/:contentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const themeId = req.params.id as string;
    const contentId = req.params.contentId as string;

    // Verify theme ownership
    const theme = await prisma.theme.findFirst({
      where: { id: themeId, userId },
    });

    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Delete the join record
    await prisma.contentTheme.deleteMany({
      where: { themeId, contentId },
    });

    // Clear cached memo so next view triggers fresh generation
    await prisma.theme.update({
      where: { id: themeId },
      data: { memo: null, memoGeneratedAt: null },
    });

    // Delete synthesis quizzes for this theme (they reference old content combinations)
    await prisma.quiz.deleteMany({
      where: { themeId, isSynthesis: true },
    });
    log.info({ themeId, action: 'synthesis-invalidated' }, 'Synthesis quizzes cleared on content change');

    return res.json({ message: 'Content removed from theme' });
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// GET /:id/memo -- Get or generate theme synthesis memo (24h cache)
// ============================================================================

themeRouter.get('/:id/memo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const themeId = req.params.id as string;

    // Look up theme with ownership check
    const theme = await prisma.theme.findFirst({
      where: { id: themeId, userId },
    });

    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Cache check: memo exists and is less than 24h old
    if (theme.memo && theme.memoGeneratedAt) {
      const age = Date.now() - new Date(theme.memoGeneratedAt).getTime();
      if (age < MEMO_TTL_MS) {
        // Count content items for response
        const contentCount = await prisma.contentTheme.count({ where: { themeId } });
        log.info({ themeId, cached: true, ageHours: Math.round(age / 3600000) }, 'Theme memo cache hit');
        return res.json({
          memo: theme.memo,
          themeName: theme.name,
          contentCount,
          generatedAt: theme.memoGeneratedAt.toISOString(),
          cached: true,
        });
      }
    }

    log.info({ themeId, cached: false }, 'Theme memo cache miss, generating');

    // Query content items in theme via ContentTheme join
    const contents = await prisma.content.findMany({
      where: {
        userId,
        status: 'READY',
        contentThemes: { some: { themeId } },
      },
      include: {
        transcript: true,
      },
      orderBy: { capturedAt: 'desc' },
      take: 15, // Cap at 15 memos for LLM prompt size
    });

    // Collect per-content memos from transcript.segments.memo
    const contentMemos: string[] = [];
    for (const content of contents) {
      const transcriptMeta = content.transcript?.segments as any;
      if (transcriptMeta?.memo) {
        contentMemos.push(`**${content.title}**\n${transcriptMeta.memo}`);
      }
    }

    if (contentMemos.length === 0) {
      return res.status(400).json({
        error: 'Aucun memo disponible pour les contenus de ce theme.',
        hint: 'Les memos sont generes lors du traitement des quiz.',
      });
    }

    // Build synthesis prompt (400 word max, French, following topic memo pattern)
    const systemPrompt = `Tu es un assistant d'apprentissage expert. A partir des memos individuels fournis, cree un memo de synthese pour le theme "${theme.name}".
Le memo doit:
- Synthetiser les points cles communs et complementaires
- Organiser les concepts de maniere logique et hierarchique
- Etre structure en sections avec des bullet points
- Mettre en evidence les connexions entre les differents contenus
- Faire maximum 400 mots
- Etre entierement en francais`;

    const userPrompt = `Theme: ${theme.name}
Nombre de contenus: ${contentMemos.length}

Memos individuels:
${contentMemos.join('\n\n---\n\n')}

Genere un memo de synthese pour ce theme.`;

    const synthesized = await generateText(userPrompt, { system: systemPrompt, temperature: 0.7 });

    // Cache result in Theme row
    const now = new Date();
    await prisma.theme.update({
      where: { id: themeId },
      data: { memo: synthesized, memoGeneratedAt: now },
    });

    return res.json({
      memo: synthesized,
      themeName: theme.name,
      contentCount: contentMemos.length,
      generatedAt: now.toISOString(),
      cached: false,
    });
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// POST /:id/memo/refresh -- Force-refresh theme synthesis memo
// ============================================================================

themeRouter.post('/:id/memo/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const themeId = req.params.id as string;

    // Look up theme with ownership check
    const theme = await prisma.theme.findFirst({
      where: { id: themeId, userId },
    });

    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    log.info({ themeId }, 'Theme memo force-refresh requested');

    // Query content items in theme via ContentTheme join (always regenerate, bypass cache)
    const contents = await prisma.content.findMany({
      where: {
        userId,
        status: 'READY',
        contentThemes: { some: { themeId } },
      },
      include: {
        transcript: true,
      },
      orderBy: { capturedAt: 'desc' },
      take: 15,
    });

    // Collect per-content memos
    const contentMemos: string[] = [];
    for (const content of contents) {
      const transcriptMeta = content.transcript?.segments as any;
      if (transcriptMeta?.memo) {
        contentMemos.push(`**${content.title}**\n${transcriptMeta.memo}`);
      }
    }

    if (contentMemos.length === 0) {
      return res.status(400).json({
        error: 'Aucun memo disponible pour les contenus de ce theme.',
        hint: 'Les memos sont generes lors du traitement des quiz.',
      });
    }

    // Build synthesis prompt
    const systemPrompt = `Tu es un assistant d'apprentissage expert. A partir des memos individuels fournis, cree un memo de synthese pour le theme "${theme.name}".
Le memo doit:
- Synthetiser les points cles communs et complementaires
- Organiser les concepts de maniere logique et hierarchique
- Etre structure en sections avec des bullet points
- Mettre en evidence les connexions entre les differents contenus
- Faire maximum 400 mots
- Etre entierement en francais`;

    const userPrompt = `Theme: ${theme.name}
Nombre de contenus: ${contentMemos.length}

Memos individuels:
${contentMemos.join('\n\n---\n\n')}

Genere un memo de synthese pour ce theme.`;

    const synthesized = await generateText(userPrompt, { system: systemPrompt, temperature: 0.7 });

    // Save to cache
    const now = new Date();
    await prisma.theme.update({
      where: { id: themeId },
      data: { memo: synthesized, memoGeneratedAt: now },
    });

    return res.json({
      memo: synthesized,
      themeName: theme.name,
      contentCount: contentMemos.length,
      generatedAt: now.toISOString(),
      regenerated: true,
    });
  } catch (error) {
    return next(error);
  }
});
