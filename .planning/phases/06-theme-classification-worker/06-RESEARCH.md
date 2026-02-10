# Phase 6: Theme Classification Worker - Research

**Researched:** 2026-02-10
**Domain:** LLM-based tag clustering, background worker design, deduplication, cron scheduling
**Confidence:** HIGH

## Summary

Phase 6 introduces an AI-powered worker that automatically generates themes from a user's tag history and classifies new content into those themes. The core technical challenge is designing a Mistral AI prompt that clusters ~50-400 unique tags per user into 5-15 coherent themes, handles bilingual tags (French/English duplicates like "music"/"musique", "rap"/"french rap"/"hip hop"), and prevents near-duplicate theme creation on subsequent runs.

The existing codebase provides all infrastructure needed: the worker pattern (`runJob` + `trackJobExecution` + `runningJobs` overlap prevention), the LLM client (`getLLMClient().chatCompletion()` with JSON mode), the rate limiter (`llmLimiter` at 5 concurrent), and the tag/theme Prisma models (Phase 5). No new dependencies are required. The worker will follow the exact same pattern as `runAutoTaggingWorker()` in `tagging.ts` -- query eligible users, process each with `pLimit`, call LLM, write results to database.

Real production data shows the primary user has 408 unique tags across 479 content items, with heavy duplication: "music"/"musique" (22+14 uses), "rap"/"french rap"/"rap francais"/"hip hop" (17+13+5+6 uses), "jeu video"/"gaming"/"esport" (16+7+9 uses). Of 893 total content items, 204 have tags and 0 have theme assignments -- this is the backfill scope. The long tail is significant: 398 of 532 tags are used only once. The LLM must handle this distribution intelligently -- ignore single-use noise, merge synonymous clusters, produce actionable themes.

**Primary recommendation:** Build a two-stage worker: (1) Theme Generation -- for users with 10+ tagged items and 0 themes, cluster their tags via a single LLM call, create themes + ThemeTag links + ContentTheme assignments in one transaction; (2) Theme Classification -- for users who already have themes, classify newly tagged content into existing themes via a lighter LLM call. Add a one-time backfill mode triggered via admin panel. All prompts in French (matching existing tagging/quiz prompts).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | ^6.2.1 | ORM for Theme, ContentTheme, ThemeTag, Tag queries | Already in use |
| pino | ^10.3.0 | Structured logging via `logger.child()` | Already in use |
| p-limit | (installed) | Concurrency control for LLM calls per user | Already in use in tagging.ts, quizGeneration.ts |
| node-cron | (installed) | Cron scheduling | Already in use in scheduler.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| LLM service (`./llm.ts`) | N/A | Mistral AI chat completions with JSON mode | Theme clustering and content classification |
| Rate limiter (`./rateLimiter.ts`) | N/A | `llmLimiter` (5 concurrent) for LLM calls | Shared with quiz and tagging workers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| LLM clustering | Vector embeddings + k-means | Overkill for 50-400 tags, requires embedding model, additional dependency. LLM is simpler and already available |
| Single LLM call per user | Multiple calls (one per tag group) | Single call is cheaper and faster; the tag list for one user fits easily in context (408 tags ~ 1500 tokens) |
| Real-time classification (on tag creation) | Batch worker (cron) | Batch is simpler, matches existing architecture, avoids blocking the tagging worker |

**Installation:**
```bash
# No new packages needed -- all dependencies already exist
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── services/
│   └── themeClassification.ts    # NEW: Theme generation + classification logic
├── workers/
│   └── scheduler.ts             # MODIFIED: Add theme-classification cron entry
├── routes/
│   └── admin.ts                 # MODIFIED: Add theme-classification + backfill trigger
├── admin/
│   └── actions.ts               # MODIFIED: Add admin panel trigger action
```

### Pattern 1: Two-Stage Worker Architecture
**What:** Split the worker into two distinct operations that run in sequence: (A) Theme Generation for users without themes, (B) Content Classification for users with themes but unclassified content.
**When to use:** When the same cron job needs to handle initial setup and ongoing maintenance.
**Why:** Theme generation is a heavy, one-time-per-user operation (reads all tags, creates themes). Classification is lighter and ongoing (reads new content tags, maps to existing themes). Splitting them keeps each stage focused and debuggable.

```typescript
export async function runThemeClassificationWorker(): Promise<void> {
  // Stage A: Generate themes for users who have enough tags but no themes
  await generateThemesForNewUsers();

  // Stage B: Classify unthemed content for users who already have themes
  await classifyUnthemedContent();
}
```

### Pattern 2: Tag Clustering via Single LLM Call
**What:** Send the user's complete tag list (with usage counts) to Mistral AI in one call, requesting clustered theme output.
**When to use:** Theme generation (Stage A). This is the core intelligence of the worker.
**Why:** A single call is cheaper, faster, and produces more globally coherent themes than multiple calls. Even a user with 408 tags produces a compact input (~1500 tokens of tag names).

**Critical prompt design elements:**
1. Pass ALL tags with usage counts so the LLM can weight by importance
2. Pass existing themes (if any) to prevent duplicates (CLASS-04)
3. Request French names (matching existing prompt language)
4. Request a target of 5-15 themes (CLASS-01)
5. Instruct to merge synonyms across languages ("music" + "musique" -> one theme)
6. Request associated tags for each theme (to populate ThemeTag)
7. Request a color and emoji for each theme (for UI display)

```typescript
// Example prompt structure (details in Code Examples section)
const prompt = `Voici les tags d'un utilisateur avec leur fréquence d'utilisation:
${tagList}

${existingThemes.length > 0 ? `Thèmes existants (NE PAS créer de doublons): ${existingThemes}` : ''}

Regroupe ces tags en 5-15 thèmes cohérents...`;
```

### Pattern 3: Content Classification via Tag Matching + LLM Fallback
**What:** For classifying new content into existing themes, first attempt deterministic matching via ThemeTag table, then use LLM as fallback for ambiguous cases.
**When to use:** Stage B (ongoing classification).
**Why:** Most content will have tags that already map to a theme via ThemeTag. Only genuinely new tag combinations need LLM intervention. This reduces LLM costs significantly.

```typescript
async function classifyContent(contentId: string, userThemes: ThemeWithTags[]): Promise<string[]> {
  const content = await getContentWithTags(contentId);

  // Step 1: Deterministic match -- check if any content tags appear in ThemeTag
  const matchedThemeIds = findThemesByTagOverlap(content.tags, userThemes);

  if (matchedThemeIds.length > 0) {
    return matchedThemeIds; // No LLM needed
  }

  // Step 2: LLM fallback -- ask which existing themes match this content
  return classifyViaLLM(content, userThemes);
}
```

### Pattern 4: Idempotent Worker Runs (Deduplication)
**What:** Ensure running the worker twice produces the same result. Themes must not be duplicated, content must not be double-assigned.
**When to use:** Every worker run.
**How:**
1. Theme generation checks for existing themes before creating (skip users with themes already)
2. When creating themes, use `@@unique([userId, slug])` constraint + `findFirst` pre-check
3. ContentTheme uses `@@unique([contentId, themeId])` + `createMany({ skipDuplicates: true })`
4. For theme name deduplication, compare slugs (not raw names) to catch "IA" vs "Intelligence Artificielle" -> same slug "ia" / "intelligence-artificielle"

### Pattern 5: Backfill as One-Time Admin-Triggered Job
**What:** A dedicated function that processes ALL existing tagged content for ALL users, creating themes and assignments in bulk.
**When to use:** Once, after deploying Phase 6, to populate themes for existing data.
**How:** Same logic as the regular worker but without the "10+ tagged items" gate and processing all users regardless of existing themes.

```typescript
export async function runBackfillThemes(): Promise<void> {
  // Get ALL users with tagged content
  const users = await getUsersWithTaggedContent(/* no minimum threshold */);

  for (const user of users) {
    await generateThemesForUser(user.id);
    await classifyAllContentForUser(user.id);
  }
}
```

### Anti-Patterns to Avoid
- **One LLM call per tag:** Wastes API calls. Send all tags in one call per user.
- **Calling LLM for every content item:** Use deterministic ThemeTag matching first; LLM only for unmatched content.
- **Creating themes without checking cap:** Always check `theme.count({ where: { userId } })` before creating. If at cap, merge smallest themes or skip.
- **Modifying user-created themes:** The worker should only create system themes (`assignedBy: 'system'`). Never rename, delete, or modify user-created themes.
- **Processing all users every run:** Only process users with new unclassified content or who meet the threshold for initial generation.
- **Blocking the auto-tagging worker:** Theme classification runs on its own cron schedule, after tagging completes. It does NOT add latency to the tagging pipeline.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Overlap prevention | Custom locking | `runningJobs` Set in scheduler.ts | Already handles job overlap via `runJob()` wrapper |
| Job execution tracking | Custom logging | `trackJobExecution()` in jobExecutionTracker.ts | Already persists RUNNING/SUCCESS/FAILED to JobExecution table |
| LLM rate limiting | Custom queue | `llmLimiter` from rateLimiter.ts | Shared pLimit(5) already configured for Mistral |
| Concurrency control | Custom semaphore | `pLimit` (already imported in tagging.ts) | Proven pattern, used in 3+ existing workers |
| Slug generation | New function | Import `generateSlug` from themes.ts | Already exists and handles French accents |
| Admin panel trigger | New admin UI | `createTriggerAction()` from admin/actions.ts | Factory function for one-click triggers |

**Key insight:** Every infrastructure piece needed already exists. The novel work is exclusively in the LLM prompt design and the two-stage processing logic.

## Common Pitfalls

### Pitfall 1: LLM Returns Duplicate/Near-Duplicate Themes
**What goes wrong:** Mistral creates both "Intelligence Artificielle" and "Machine Learning" as separate themes, or "Music" and "Musique".
**Why it happens:** LLM doesn't naturally deduplicate across languages without explicit instruction.
**How to avoid:** (1) Instruct the LLM explicitly to merge synonyms and bilingual duplicates. (2) Post-process LLM output: generate slugs for proposed themes and compare against existing theme slugs. (3) Pass existing themes in the prompt so the LLM knows what already exists.
**Warning signs:** Users getting 20+ themes when they should have 8-12.

### Pitfall 2: Theme Explosion from Low-Frequency Tags
**What goes wrong:** LLM creates a theme for every single-use tag, resulting in 50+ tiny themes.
**Why it happens:** 398 of 532 tags in production are used only once. Without guidance, the LLM tries to be comprehensive.
**How to avoid:** (1) Filter out single-use tags before sending to LLM, or weight them very low. (2) Set a hard cap in the prompt ("5-15 themes maximum"). (3) Enforce MAX_THEMES_PER_USER=25 at the database level.
**Warning signs:** Themes with only 1 content item each.

### Pitfall 3: Worker Runs Before Tags Exist
**What goes wrong:** The classification worker runs for a user who has content but no tags yet (auto-tagging hasn't completed).
**Why it happens:** Content pipeline is: sync -> transcribe -> quiz -> tag -> classify. If the classification worker runs too early in the cycle, it finds nothing to classify.
**How to avoid:** Gate theme generation on "user has 10+ tagged content items" (not just "10+ content items"). Gate classification on "content has tags but no theme assignments".
**Warning signs:** Worker runs but processes 0 items every cycle.

### Pitfall 4: Blocking LLM Calls for All Users Sequentially
**What goes wrong:** Processing 100 users sequentially with LLM calls takes too long, causing cron job overlap.
**Why it happens:** Each LLM call takes 2-5 seconds. 100 users * 2 calls = 200-500 seconds.
**How to avoid:** Use `pLimit(3)` for user-level concurrency (3 users in parallel). Each user's LLM call is already gated by `llmLimiter(5)`. Total wall time stays reasonable.
**Warning signs:** Job duration exceeding 5 minutes in job_executions table.

### Pitfall 5: Backfill Creates Themes for Inactive Users
**What goes wrong:** The backfill job creates themes for users with 1-2 tagged content items, producing meaningless themes.
**Why it happens:** No minimum threshold applied during backfill.
**How to avoid:** Apply the same "10+ tagged content items" threshold during backfill. Users below threshold will get themes generated naturally as they accumulate more content.
**Warning signs:** Users with 2-3 content items having 5 themes each.

### Pitfall 6: LLM JSON Parsing Failure
**What goes wrong:** Mistral returns malformed JSON, crashing the worker for that user.
**Why it happens:** LLM output is probabilistic; JSON mode reduces but doesn't eliminate malformed output.
**How to avoid:** (1) Always wrap `JSON.parse()` in try/catch. (2) Validate parsed output structure (is it an array of objects with expected fields?). (3) Log the raw response on failure for debugging. (4) Skip the user and continue with the next one. Follow exact pattern from `tagging.ts` lines 66-80.
**Warning signs:** `JSON.parse` errors in PM2 logs.

### Pitfall 7: ThemeTag Population Incomplete
**What goes wrong:** Themes are created but ThemeTag links are missing, so deterministic classification (Pattern 3, Step 1) always fails and falls back to LLM.
**Why it happens:** Forgetting to create ThemeTag records when creating themes from the LLM response.
**How to avoid:** The LLM response must include which tags belong to each theme. Create ThemeTag records in the same transaction as the Theme records.
**Warning signs:** `findThemesByTagOverlap()` always returns empty, every classification goes to LLM.

## Code Examples

Verified patterns adapted from existing codebase:

### Theme Generation LLM Prompt
```typescript
// Source: Adapted from tagging.ts prompt pattern
async function generateThemesFromTags(
  userTags: { name: string; count: number }[],
  existingThemes: { name: string; slug: string }[]
): Promise<GeneratedTheme[]> {
  const llm = getLLMClient();

  // Format tags with usage counts, sorted by frequency
  const tagList = userTags
    .sort((a, b) => b.count - a.count)
    .map(t => `- "${t.name}" (${t.count} contenus)`)
    .join('\n');

  const existingList = existingThemes.length > 0
    ? `\n\nThemes EXISTANTS (NE PAS creer de doublons ni de variantes):\n${existingThemes.map(t => `- "${t.name}"`).join('\n')}`
    : '';

  const response = await llmLimiter(() => llm.chatCompletion({
    messages: [
      {
        role: 'system',
        content: `Tu es un expert en organisation de connaissances. Tu regroupes des tags de contenu en themes coherents.

Regles:
- Genere entre 5 et 15 themes maximum
- Chaque theme regroupe des tags SEMANTIQUEMENT proches
- Fusionne les synonymes et traductions (ex: "music" + "musique" = un seul theme)
- Fusionne les variantes (ex: "rap", "french rap", "hip hop" = un seul theme)
- Ignore les tags utilises une seule fois sauf s'ils correspondent a un theme existant
- Noms de themes en francais, clairs et concis (2-4 mots max)
- Chaque theme doit avoir un emoji representatif et une couleur hex
- Un tag peut appartenir a plusieurs themes si pertinent

Reponds UNIQUEMENT en JSON valide.`,
      },
      {
        role: 'user',
        content: `Voici les tags d'un utilisateur avec leur frequence d'utilisation:
${tagList}
${existingList}

Regroupe ces tags en themes coherents. Pour chaque theme, indique:
- name: nom du theme en francais
- emoji: un emoji representatif
- color: code hex (parmi: #EF4444, #F97316, #EAB308, #22C55E, #14B8A6, #3B82F6, #6366F1, #8B5CF6, #EC4899, #F43F5E, #06B6D4, #84CC16)
- tags: liste des tags regroupes dans ce theme

Format:
{
  "themes": [
    {
      "name": "Nom du theme",
      "emoji": "emoji",
      "color": "#hex",
      "tags": ["tag1", "tag2", "tag3"]
    }
  ]
}`,
      },
    ],
    temperature: 0.3,
    maxTokens: 2000,
    jsonMode: true,
  }));

  // Parse and validate
  const content = response.content?.trim();
  if (!content) return [];

  try {
    const parsed = JSON.parse(content);
    if (!parsed.themes || !Array.isArray(parsed.themes)) return [];
    return parsed.themes.filter(
      (t: any) => t.name && typeof t.name === 'string' && t.tags && Array.isArray(t.tags)
    );
  } catch {
    log.error({ content }, 'Failed to parse theme generation JSON');
    return [];
  }
}
```

### Content Classification LLM Prompt (Fallback)
```typescript
// Source: Adapted from tagging.ts for lighter classification
async function classifyContentViaLLM(
  contentTitle: string,
  contentTags: string[],
  existingThemes: { id: string; name: string; tags: string[] }[]
): Promise<string[]> {
  const llm = getLLMClient();

  const themeList = existingThemes
    .map(t => `- "${t.name}" (tags: ${t.tags.join(', ')})`)
    .join('\n');

  const response = await llmLimiter(() => llm.chatCompletion({
    messages: [
      {
        role: 'system',
        content: `Tu classes du contenu dans des themes existants. Reponds UNIQUEMENT en JSON valide.`,
      },
      {
        role: 'user',
        content: `Contenu: "${contentTitle}"
Tags du contenu: ${contentTags.join(', ')}

Themes disponibles:
${themeList}

Dans quel(s) theme(s) ce contenu devrait-il etre classe? (1 a 3 themes max)

Reponds: { "themeNames": ["Nom theme 1", "Nom theme 2"] }
Si aucun theme ne correspond, reponds: { "themeNames": [] }`,
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
    return [];
  }
}
```

### Worker Main Function (Following tagging.ts Pattern)
```typescript
// Source: Pattern from tagging.ts runAutoTaggingWorker()
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
      select: { id: true },
    });

    // Filter to users with 10+ tagged content items
    const eligibleUsers = [];
    for (const user of usersNeedingThemes) {
      const taggedCount = await prisma.content.count({
        where: { userId: user.id, tags: { some: {} } },
      });
      if (taggedCount >= 10) {
        eligibleUsers.push(user);
      }
    }

    if (eligibleUsers.length > 0) {
      log.info({ count: eligibleUsers.length }, 'Generating themes for new users');
      const userLimit = pLimit(3);
      await Promise.allSettled(
        eligibleUsers.map(user => userLimit(() => generateThemesForUser(user.id)))
      );
    }

    // Stage B: Classify unthemed content for users with existing themes
    // Find content that has tags but no theme assignments
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
      log.info({ count: unclassifiedContent.length }, 'Classifying unthemed content');
      const classifyLimit = pLimit(5);
      await Promise.allSettled(
        unclassifiedContent.map(c =>
          classifyLimit(() => classifyContentForUser(c.id, c.userId))
        )
      );
    }

    log.info('Theme classification worker completed');
  } catch (error) {
    log.error({ err: error }, 'Theme classification worker error');
  }
}
```

### Scheduler Integration
```typescript
// Source: Pattern from scheduler.ts
// Add to scheduler.ts imports:
import { runThemeClassificationWorker } from '../services/themeClassification.js';

// Add cron entry (after auto-tagging, since themes depend on tags):
// Theme Classification Worker - Every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  log.info({ job: 'theme-classification' }, 'Triggering scheduled job');
  await runJob('theme-classification', runThemeClassificationWorker);
});
```

### Admin Trigger Integration
```typescript
// Source: Pattern from admin/actions.ts
// Add to triggerJob union type:
type JobName = ... | 'theme-classification' | 'theme-backfill';

// Add cases to triggerJob switch:
case 'theme-classification':
  await runJob('theme-classification', runThemeClassificationWorker, triggerSource);
  return { success: true, message: 'Theme classification worker completed' };
case 'theme-backfill':
  await runJob('theme-backfill', runBackfillThemes, triggerSource);
  return { success: true, message: 'Theme backfill completed' };
```

### Backfill Function
```typescript
export async function runBackfillThemes(): Promise<void> {
  log.info('Theme backfill starting');

  // Get all users with tagged content (threshold: 10+)
  const users = await prisma.user.findMany({
    where: {
      contents: {
        some: { tags: { some: {} } },
      },
    },
    select: { id: true },
  });

  for (const user of users) {
    const taggedCount = await prisma.content.count({
      where: { userId: user.id, tags: { some: {} } },
    });
    if (taggedCount < 10) continue;

    // Generate themes if user has none
    const themeCount = await prisma.theme.count({ where: { userId: user.id } });
    if (themeCount === 0) {
      await generateThemesForUser(user.id);
    }

    // Classify all tagged content without theme assignments
    const unthemed = await prisma.content.findMany({
      where: {
        userId: user.id,
        tags: { some: {} },
        contentThemes: { none: {} },
      },
      select: { id: true },
    });

    const limit = pLimit(5);
    await Promise.allSettled(
      unthemed.map(c => limit(() => classifyContentForUser(c.id, user.id)))
    );
  }

  log.info('Theme backfill completed');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual theme creation | AI auto-generation from tags | This phase (new) | Users get organized without effort |
| Vector embeddings for classification | LLM prompt-based clustering | N/A | LLM is simpler when tag space is small (50-400 per user) |
| Tag-only organization | Theme layer above tags | This phase (new) | Higher-level grouping for navigation and quizzes |
| Per-item tagging only | Batch tag clustering | This phase (new) | Themes emerge from patterns across all content |

**Deprecated/outdated:**
- N/A -- this is a new capability, no prior implementation to deprecate

## Open Questions

1. **Optimal cron frequency for theme classification**
   - What we know: Auto-tagging runs every 15 minutes. Theme classification should run after tagging.
   - What's unclear: Should it be 15 minutes (same as tagging) or 30 minutes (less frequent)? Could run on the same 15-minute cycle since most runs will be no-ops.
   - Recommendation: Start at every 15 minutes. The worker has built-in short-circuiting (skip if no work). Adjust based on JobExecution duration data.

2. **How to handle the `generateSlug` duplication**
   - What we know: `generateSlug()` already exists in `themes.ts` (route file). The worker service also needs it.
   - What's unclear: Should we extract it to a shared utility or duplicate it?
   - Recommendation: Extract to a shared utility file (e.g., `src/utils/slug.ts`) and import from both `themes.ts` and `themeClassification.ts`. Keeps code DRY.

3. **Color palette for AI-generated themes**
   - What we know: Phase 5 research identified 10-15 visually distinct colors as needed. The LLM prompt should specify available colors.
   - What's unclear: Exact palette values.
   - Recommendation: Use a fixed palette of 12 colors in the prompt (Tailwind-based, visually distinct): `#EF4444, #F97316, #EAB308, #22C55E, #14B8A6, #3B82F6, #6366F1, #8B5CF6, #EC4899, #F43F5E, #06B6D4, #84CC16`. Hardcode in the service file.

4. **Single-use tag handling**
   - What we know: 398/532 tags are used only once. Including all of them bloats the prompt and produces noisy themes.
   - What's unclear: Should single-use tags be excluded entirely, or included with low weight?
   - Recommendation: Include only tags used 2+ times in the main clustering prompt. After themes are created, single-use tags can still match via ThemeTag if they're semantically close to a theme's tag cluster (the LLM might include them in a theme's tag list even though they're low-frequency). This balances signal vs. noise.

5. **Theme regeneration policy**
   - What we know: Success criteria #4 says "running twice doesn't create duplicates." But what if the user's tag landscape changes significantly (e.g., 50 new tags after months of use)?
   - What's unclear: Should the worker ever regenerate/reorganize themes for an existing user?
   - Recommendation: For v1, skip users who already have themes. Add a "regenerate themes" button in Phase 7 (iOS management) that clears system-generated themes and re-runs generation. This keeps Phase 6 simple.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `backend/src/services/tagging.ts` (auto-tagging worker pattern), `backend/src/services/llm.ts` (LLM client API), `backend/src/workers/scheduler.ts` (cron scheduling), `backend/src/workers/jobExecutionTracker.ts` (job tracking), `backend/src/routes/themes.ts` (theme CRUD, slug generation), `backend/src/admin/actions.ts` (admin triggers), `backend/src/utils/rateLimiter.ts` (pLimit configuration)
- Prisma schema: `backend/prisma/schema.prisma` (Theme, ContentTheme, ThemeTag, Tag models, all relation and constraint patterns)
- Production database: Supabase SQL queries confirming 893 content items, 204 tagged, 532 tags (398 single-use), 0 existing themes, bilingual tag distribution

### Secondary (MEDIUM confidence)
- Phase 5 research and summaries: Confirmed architecture patterns, slug generation, cap enforcement, Zod validation

### Tertiary (LOW confidence)
- N/A -- all findings verified with direct codebase and database inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies, all patterns verified in codebase
- Architecture: HIGH -- Direct extension of tagging.ts worker pattern, all infrastructure exists
- LLM prompt design: MEDIUM -- Prompt engineering is empirical; the structure follows existing patterns (tagging, quiz), but optimal clustering prompt needs testing with real data
- Pitfalls: HIGH -- Based on real production data analysis (tag distribution, deduplication challenges)

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain, no external dependency changes expected)
