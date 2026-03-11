// Theme Image Matching Service
// Uses vector similarity to find the best pre-generated image for a theme.
import { prisma } from '../config/database.js';
import { generateEmbedding } from './llm.js';
import { logger } from '../config/logger.js';

const log = logger.child({ service: 'theme-image-matching' });

interface ThemeImageMatch {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  similarity: number;
}

/**
 * Find the best matching pre-generated image for a theme based on its name and tags.
 * Uses cosine similarity between the theme's text embedding and stored image embeddings.
 */
export async function findBestImageForTheme(
  themeName: string,
  tags: string[]
): Promise<string | null> {
  try {
    const text = `${themeName}: ${tags.join(', ')}`;
    const embedding = await generateEmbedding(text);
    const embeddingStr = `[${embedding.join(',')}]`;

    const results = await prisma.$queryRawUnsafe<ThemeImageMatch[]>(
      `SELECT id, slug, name, image_url as "imageUrl",
              1 - (embedding <=> $1::vector) as similarity
       FROM theme_images
       WHERE image_url IS NOT NULL AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT 1`,
      embeddingStr
    );

    if (results.length === 0) {
      log.warn('No theme images found in database');
      return null;
    }

    const best = results[0];
    log.info(
      { themeName, matchedImage: best.slug, similarity: best.similarity.toFixed(3) },
      'Matched theme to image'
    );

    return best.imageUrl;
  } catch (err) {
    log.error({ err, themeName }, 'Failed to find image for theme');
    return null;
  }
}

/**
 * Assign images to all themes that don't have one yet.
 * Useful for backfilling existing themes.
 */
export async function backfillThemeImages(): Promise<number> {
  const themes = await prisma.theme.findMany({
    where: { imageUrl: null },
    include: { themeTags: { include: { tag: true } } },
  });

  if (themes.length === 0) {
    log.info('All themes already have images');
    return 0;
  }

  log.info({ count: themes.length }, 'Backfilling theme images');
  let updated = 0;

  for (const theme of themes) {
    const tags = theme.themeTags.map(tt => tt.tag.name);
    const imageUrl = await findBestImageForTheme(theme.name, tags);

    if (imageUrl) {
      await prisma.theme.update({
        where: { id: theme.id },
        data: { imageUrl },
      });
      updated++;
    }
  }

  log.info({ updated, total: themes.length }, 'Theme image backfill complete');
  return updated;
}
