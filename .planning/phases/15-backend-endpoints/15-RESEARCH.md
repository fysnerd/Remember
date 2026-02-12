# Phase 15: Backend Endpoints - Research

**Researched:** 2026-02-12
**Domain:** Express.js API endpoints + Prisma ORM queries + Mistral AI LLM integration
**Confidence:** HIGH

## Summary

Phase 15 adds two new endpoints to the existing `themeRouter` in `backend/src/routes/themes.ts`: a daily themes selector (`GET /api/themes/daily`) and an AI-powered theme suggestions generator (`GET /api/themes/suggestions`). Both endpoints are authenticated, return JSON, and follow the exact patterns already established in the codebase.

The daily themes endpoint is a pure database query -- it fetches the user's discovered themes with their progress metrics (due cards, new content, recency) and applies a smart selection/rotation algorithm to return exactly 3 themes. No LLM call needed. The existing `GET /api/themes` endpoint already computes `dueCards`, `totalCards`, `masteredCards` via a raw SQL query joined through `ContentTheme -> Quiz -> Card`, so the daily endpoint can reuse or adapt that exact query.

The theme suggestions endpoint calls Mistral AI (via the existing `llm.ts` service with `jsonMode: true`) to generate 8 new theme ideas based on the user's existing tags, themes, and content patterns. It must handle edge cases gracefully: users with no content, users with no tags, and Mistral API failures.

**Primary recommendation:** Add both endpoints as new route handlers inside the existing `themeRouter` file (no new files needed for routes). Extract the daily theme selection logic into a helper function for testability. Use the existing `llmLimiter` for the suggestions endpoint to respect Mistral rate limits. Wire the iOS `useDailyThemes` hook to the new backend endpoint and create a new `useThemeSuggestions` hook for the Explorer suggestions tab.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express.js | 4.x | Route handlers | Already used for all 10 route files |
| Prisma | 5.x | ORM + raw SQL | Already used for all DB queries |
| Zod | 3.x | Input validation | Already used in themes.ts for request validation |
| Mistral AI | via `llm.ts` | Theme suggestion generation | Production LLM provider already configured |
| p-limit | 5.x | Rate limiting LLM calls | Already used via `llmLimiter` singleton |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | 5.x | React Query hooks (iOS) | For `useDailyThemes` and `useThemeSuggestions` hooks |
| Axios | 1.x | HTTP client (iOS) | Already configured in `ios/lib/api.ts` |

### Alternatives Considered

No alternatives needed -- this phase uses 100% existing stack. No new dependencies.

**Installation:**
```bash
# No new packages needed -- everything already installed
```

## Architecture Patterns

### Where to Add Code

The backend changes fit entirely within existing files:

```
backend/src/routes/themes.ts        # Add 2 new GET handlers
ios/hooks/useDailyThemes.ts         # Replace stub with real API call
ios/hooks/useThemeSuggestions.ts     # NEW: hook for suggestions endpoint
ios/hooks/index.ts                  # Export new hook
ios/app/(tabs)/library.tsx           # Wire suggestions tab to real data
```

### Pattern 1: Daily Themes Endpoint (GET /api/themes/daily)

**What:** Returns exactly 3 themes selected for today's learning, prioritized by due reviews, new content, and smart rotation.

**Selection algorithm:**
1. Query all discovered themes for the user with their progress metrics (same raw SQL as existing `GET /`)
2. Score each theme: `score = (dueCards * 3) + (newContentCount * 2) + recencyBonus`
   - `dueCards`: Cards with `nextReviewAt <= NOW()` -- highest priority signal
   - `newContentCount`: Content items added in last 7 days (`assignedAt > NOW() - 7 days`)
   - `recencyBonus`: 1 point if theme was updated in last 24h (keeps active themes visible)
3. Sort by score descending
4. Return top 3

**Edge cases:**
- User has 0-2 themes: return all themes (1 or 2), not padded to 3
- User has 0 themes: return empty array `{ themes: [] }`

**Response shape:**
```typescript
{
  themes: ThemeListItem[] // max 3, same shape as GET /api/themes response items
}
```

**Why this shape:** The iOS `DailyThemeCard` component already consumes `ThemeListItem` type with `dueCards`, `totalCards`, `masteryPercent`, `contentCount`, etc. Returning the same shape means zero frontend type changes.

### Pattern 2: Theme Suggestions Endpoint (GET /api/themes/suggestions)

**What:** Returns 8 AI-generated theme ideas the user hasn't explored yet.

**Algorithm:**
1. Gather context: user's existing theme names, user's tag cloud (with frequency counts), recent content titles
2. Build LLM prompt asking for 8 theme suggestions that are:
   - Different from existing themes
   - Based on patterns in the user's content/tags
   - Each with a name, emoji, and short description (1 sentence)
3. Parse JSON response, validate, return

**Edge cases:**
- User has no content/tags: return curated fallback suggestions (hardcoded list of 8 universal learning themes)
- Mistral API error: return fallback suggestions with a `fallback: true` flag
- User already has 25 themes (cap): still return suggestions (user may want to replace themes)

**Response shape:**
```typescript
{
  suggestions: {
    name: string;      // e.g. "Intelligence Artificielle"
    emoji: string;     // e.g. "🤖"
    description: string; // e.g. "Concepts cles du machine learning et deep learning"
  }[];
  fallback: boolean; // true if LLM failed and we used hardcoded list
}
```

### Pattern 3: Existing Codebase Patterns to Follow

Source: Direct codebase analysis of `backend/src/routes/themes.ts`

**Authentication:** All theme routes use `authenticateToken` middleware (applied once via `themeRouter.use(authenticateToken)`). New endpoints inherit this automatically.

**Error handling:** Use `try/catch` with `next(error)` for unhandled errors. Use direct `res.status(4xx).json()` for business logic errors.

**Logging:** Create child logger `const log = logger.child({ route: 'themes' })` (already exists in themes.ts).

**LLM calls:** Use `getLLMClient()` for chat completions or `generateText()` convenience wrapper. Always wrap with `llmLimiter()` from `utils/rateLimiter.ts` for concurrency control.

**JSON mode:** Set `jsonMode: true` in LLM options and include "Reponds UNIQUEMENT en JSON valide" in system prompt (established pattern in themeClassification.ts and tagging.ts).

### Anti-Patterns to Avoid

- **Creating new route files for 2 handlers:** The existing `themes.ts` has 8 handlers already. Adding 2 more keeps everything cohesive. No new route file needed.
- **Duplicating the progress SQL query:** The raw SQL for `totalCards`, `masteredCards`, `dueCards` already exists in `GET /`. Extract it to a shared helper or inline the query with modifications.
- **Over-engineering rotation:** A simple scoring function is sufficient. No need for persistent "last shown" tracking, daily seed hashing, or complex rotation state. The due-cards-first heuristic naturally rotates themes as users complete reviews.
- **Blocking the suggestions endpoint on LLM:** The suggestions endpoint should return quickly. Use a reasonable timeout (10s) and fall back to hardcoded suggestions if LLM is slow.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM API calls | Custom fetch to Mistral | `getLLMClient().chatCompletion()` | Handles auth, error parsing, multiple providers |
| Rate limiting | Custom queue/semaphore | `llmLimiter` from `utils/rateLimiter.ts` | Already configured at 5 concurrent, shared with all LLM callers |
| Auth middleware | Manual JWT parsing | `authenticateToken` middleware | Already applied to entire themeRouter |
| JSON validation | Manual if/else checks | Zod schemas | Consistent with all other routes |

**Key insight:** This phase introduces zero new infrastructure. Every tool needed is already battle-tested in production.

## Common Pitfalls

### Pitfall 1: Progress Query N+1

**What goes wrong:** Querying themes and then running separate queries per theme for card counts creates N+1 query patterns.
**Why it happens:** The existing `GET /` endpoint uses a single raw SQL query that aggregates across all themes in one shot. If the daily endpoint does individual queries per theme, it will be slower.
**How to avoid:** Use the same raw SQL pattern as `GET /`. The existing query joins `Theme -> ContentTheme -> Quiz -> Card` and groups by theme ID. Add scoring columns (like `newContentCount`) to the same query or run a second aggregation query, but never one query per theme.
**Warning signs:** Endpoint takes >200ms for a user with 10+ themes.

### Pitfall 2: LLM Response Parsing Failures

**What goes wrong:** Mistral returns malformed JSON, truncated responses, or unexpected structure despite `jsonMode: true`.
**Why it happens:** JSON mode constrains output format but doesn't guarantee schema compliance. LLM can still return `{ "themes": ... }` instead of `{ "suggestions": ... }` or include extra fields.
**How to avoid:** Always wrap JSON.parse in try/catch. Validate the parsed structure with array/type checks before using. Return fallback suggestions on any parse error.
**Warning signs:** Occasional 500 errors in production logs with "Failed to parse" messages.

### Pitfall 3: Empty User State

**What goes wrong:** New users or users with no themes get server errors because the query assumes data exists.
**Why it happens:** Early return paths not handled for empty theme lists.
**How to avoid:** Check `themes.length === 0` early and return `{ themes: [] }` for daily and `{ suggestions: [...fallbackList], fallback: true }` for suggestions.
**Warning signs:** 500 errors for newly registered users.

### Pitfall 4: Stale useDailyThemes Hook Cache

**What goes wrong:** The iOS hook returns stale data after a user completes reviews (dueCards count changes but cache still shows old numbers).
**Why it happens:** React Query cache isn't invalidated when reviews are submitted.
**How to avoid:** Use a `staleTime` of 60 seconds on the daily themes query. Also invalidate `['themes', 'daily']` query key when reviews are submitted (add to `useSubmitAnswer` onSuccess).
**Warning signs:** Theme cards show "5 a revoir" after user just reviewed all 5.

### Pitfall 5: Suggestions Prompt Leaking User Data

**What goes wrong:** Sending raw content titles or transcripts to the LLM when only tags/theme names are needed.
**Why it happens:** Trying to give the LLM "more context" by including content details.
**How to avoid:** Only send aggregated data to the suggestions prompt: theme names, tag names with frequency, and content count per platform. Never send individual content titles, URLs, or transcript text.
**Warning signs:** Suggestions reference specific video/podcast titles instead of general topic areas.

## Code Examples

### Daily Themes Endpoint Handler

```typescript
// Source: Adapts existing GET / pattern from backend/src/routes/themes.ts lines 52-131

themeRouter.get('/daily', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    // Single query: themes with progress + new content count
    const themesWithScores = await prisma.$queryRaw<{
      id: string;
      name: string;
      slug: string;
      color: string;
      emoji: string;
      memo: string | null;
      memoGeneratedAt: Date | null;
      discoveredAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      contentCount: bigint;
      totalCards: bigint;
      masteredCards: bigint;
      dueCards: bigint;
      newContentCount: bigint;
    }[]>`
      SELECT
        t.id, t.name, t.slug, t.color, t.emoji, t.memo,
        t."memoGeneratedAt", t."discoveredAt", t."createdAt", t."updatedAt",
        COALESCE(COUNT(DISTINCT ct.id), 0) AS "contentCount",
        COALESCE(COUNT(card.id), 0) AS "totalCards",
        COALESCE(COUNT(card.id) FILTER (WHERE card.repetitions >= 3), 0) AS "masteredCards",
        COALESCE(COUNT(card.id) FILTER (WHERE card."nextReviewAt" <= NOW()), 0) AS "dueCards",
        COALESCE(COUNT(DISTINCT ct.id) FILTER (WHERE ct."assignedAt" > NOW() - INTERVAL '7 days'), 0) AS "newContentCount"
      FROM "Theme" t
      LEFT JOIN "ContentTheme" ct ON ct."themeId" = t.id
      LEFT JOIN "Quiz" q ON q."contentId" = ct."contentId" AND q."isSynthesis" = false
      LEFT JOIN "Card" card ON card."quizId" = q.id AND card."userId" = ${userId}
      WHERE t."userId" = ${userId} AND t."discoveredAt" IS NOT NULL
      GROUP BY t.id
    `;

    // Score and sort
    const scored = themesWithScores.map(t => ({
      ...t,
      score: Number(t.dueCards) * 3 + Number(t.newContentCount) * 2 + (/* recency bonus */ isRecent(t.updatedAt) ? 1 : 0),
    }));

    scored.sort((a, b) => b.score - a.score);

    // Return top 3
    const daily = scored.slice(0, 3).map(t => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      color: t.color,
      emoji: t.emoji,
      contentCount: Number(t.contentCount),
      totalCards: Number(t.totalCards),
      masteredCards: Number(t.masteredCards),
      dueCards: Number(t.dueCards),
      masteryPercent: Number(t.totalCards) > 0 ? Math.round(Number(t.masteredCards) / Number(t.totalCards) * 100) : 0,
      tags: [], // daily view doesn't need tags
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return res.json({ themes: daily });
  } catch (error) {
    return next(error);
  }
});
```

### Theme Suggestions Endpoint Handler

```typescript
// Source: Adapts LLM call pattern from backend/src/services/themeClassification.ts

themeRouter.get('/suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    // Gather context: existing themes + tag cloud
    const [existingThemes, userTags] = await Promise.all([
      prisma.theme.findMany({
        where: { userId, discoveredAt: { not: null } },
        select: { name: true },
      }),
      prisma.$queryRaw<{ name: string; count: bigint }[]>`
        SELECT t.name, COUNT(ct."B") as count
        FROM "Tag" t
        JOIN "_ContentTags" ct ON ct."B" = t.id
        JOIN "Content" c ON c.id = ct."A"
        WHERE c."userId" = ${userId}
        GROUP BY t.name
        ORDER BY count DESC
        LIMIT 30
      `,
    ]);

    // Edge case: no tags at all
    if (userTags.length === 0) {
      return res.json({ suggestions: FALLBACK_SUGGESTIONS, fallback: true });
    }

    const existingNames = existingThemes.map(t => t.name);
    const tagList = userTags.map(t => `${t.name} (${Number(t.count)})`).join(', ');

    const llm = getLLMClient();
    const response = await llmLimiter(() => llm.chatCompletion({
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en apprentissage. Suggere 8 themes d'etude bases sur les centres d'interet de l'utilisateur.
Chaque suggestion doit avoir un nom en francais (2-4 mots), un emoji, et une description courte (1 phrase).
Les suggestions doivent etre DIFFERENTES des themes existants.
Reponds UNIQUEMENT en JSON valide.`,
        },
        {
          role: 'user',
          content: `Themes existants: ${existingNames.join(', ') || 'aucun'}
Tags et frequences: ${tagList}

Genere 8 suggestions de nouveaux themes. Format:
{ "suggestions": [{ "name": "...", "emoji": "...", "description": "..." }] }`,
        },
      ],
      temperature: 0.7,
      maxTokens: 1000,
      jsonMode: true,
    }));

    // Parse and validate
    const parsed = JSON.parse(response.content?.trim() || '{}');
    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      return res.json({ suggestions: FALLBACK_SUGGESTIONS, fallback: true });
    }

    const validated = parsed.suggestions
      .filter((s: any) => s.name && typeof s.name === 'string')
      .slice(0, 8)
      .map((s: any) => ({
        name: String(s.name).trim(),
        emoji: typeof s.emoji === 'string' ? s.emoji : '📚',
        description: typeof s.description === 'string' ? s.description.trim() : '',
      }));

    return res.json({ suggestions: validated, fallback: false });
  } catch (error) {
    log.error({ err: error }, 'Theme suggestions generation failed');
    return res.json({ suggestions: FALLBACK_SUGGESTIONS, fallback: true });
  }
});
```

### Fallback Suggestions Constant

```typescript
const FALLBACK_SUGGESTIONS = [
  { name: 'Developpement personnel', emoji: '🧠', description: 'Techniques de productivite et croissance personnelle' },
  { name: 'Sciences et technologie', emoji: '🔬', description: 'Decouvertes scientifiques et innovations technologiques' },
  { name: 'Histoire et culture', emoji: '🏛️', description: 'Evenements historiques et patrimoine culturel' },
  { name: 'Sante et bien-etre', emoji: '💪', description: 'Nutrition, exercice et sante mentale' },
  { name: 'Economie et finance', emoji: '📊', description: 'Marches financiers et principes economiques' },
  { name: 'Art et creation', emoji: '🎨', description: 'Expression artistique et processus creatifs' },
  { name: 'Philosophie et reflexion', emoji: '💭', description: 'Grandes questions philosophiques et pensee critique' },
  { name: 'Environnement et nature', emoji: '🌿', description: 'Ecologie, biodiversite et developpement durable' },
];
```

### iOS useDailyThemes Hook (Replacement)

```typescript
// Replace the stub in ios/hooks/useDailyThemes.ts
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { ThemeListItem } from '../types/content';

export function useDailyThemes() {
  return useQuery({
    queryKey: ['themes', 'daily'],
    queryFn: async () => {
      const { data } = await api.get<{ themes: ThemeListItem[] }>('/themes/daily');
      return data.themes;
    },
    staleTime: 60 * 1000, // 1 minute -- re-fetch after reviews
  });
}
```

### iOS useThemeSuggestions Hook (New)

```typescript
// New file: ios/hooks/useThemeSuggestions.ts
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

interface ThemeSuggestion {
  name: string;
  emoji: string;
  description: string;
}

interface SuggestionsResponse {
  suggestions: ThemeSuggestion[];
  fallback: boolean;
}

export function useThemeSuggestions() {
  return useQuery({
    queryKey: ['themes', 'suggestions'],
    queryFn: async () => {
      const { data } = await api.get<SuggestionsResponse>('/themes/suggestions');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes -- suggestions don't change fast
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side sorting in `useDailyThemes` | Backend `/api/themes/daily` with scoring | Phase 15 | Server computes accurate newContentCount and scoring; client just displays |
| Hardcoded "coming soon" placeholder | LLM-generated suggestions | Phase 15 | Explorer Suggestions tab becomes functional |

**Deprecated/outdated:**
- `useDailyThemes` stub (Phase 14): Will be replaced with real API call to `GET /api/themes/daily`

## Open Questions

1. **Should suggestions be cached server-side?**
   - What we know: The LLM call costs ~$0.001 per request (Mistral medium). With React Query `staleTime: 5min`, most users won't trigger it more than once per session.
   - What's unclear: Whether to add a DB-level cache (like the memo pattern with 24h TTL) or rely solely on React Query client caching.
   - Recommendation: Start with client-only caching via React Query `staleTime: 5min`. If usage metrics show excessive LLM calls, add server-side cache later. Keep it simple for now.

2. **Should the daily endpoint include tags?**
   - What we know: The existing `GET /` includes tags via `themeTags` join. The `DailyThemeCard` component doesn't display tags currently.
   - What's unclear: Whether future UI iterations will want tags on daily cards.
   - Recommendation: Return `tags: []` for now (skip the join for performance). The `ThemeListItem` type already has `tags` as required, so returning an empty array satisfies the type without the extra join.

3. **Route ordering: /daily vs /:id conflict**
   - What we know: Express matches routes in registration order. If `/daily` is registered AFTER `/:id`, Express will match `/daily` as an `:id` param.
   - Recommendation: Register `GET /daily` and `GET /suggestions` BEFORE `GET /:id` in the router file. This is critical -- named routes must precede parameterized routes.

## Sources

### Primary (HIGH confidence)
- `backend/src/routes/themes.ts` -- Existing 8-handler theme router with progress SQL query, LLM memo generation, Zod validation
- `backend/src/services/llm.ts` -- LLM client with Mistral support, `jsonMode`, `generateText()` convenience function
- `backend/src/services/themeClassification.ts` -- LLM prompt patterns for theme generation, JSON parsing with validation
- `backend/src/utils/rateLimiter.ts` -- `llmLimiter` singleton (p-limit 5 concurrent)
- `ios/hooks/useDailyThemes.ts` -- Stub hook with `// TODO: Replace with GET /api/themes/daily when Phase 15 ships`
- `ios/hooks/useThemes.ts` -- React Query patterns for theme data fetching
- `ios/types/content.ts` -- `ThemeListItem` type definition with all progress fields
- `ios/components/explorer/SuggestionCard.tsx` -- Placeholder component with `// TODO: Wire to GET /api/themes/suggestions in Phase 15`
- `ios/app/(tabs)/library.tsx` -- Explorer screen with Suggestions tab rendering `renderSuggestionsTab()` placeholder

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` -- API-01 and API-02 requirement definitions
- `.planning/phases/14-screen-rebuild/14-01-PLAN.md` -- Phase 14 decisions on useDailyThemes stub design
- `.planning/phases/14-screen-rebuild/14-02-PLAN.md` -- Phase 14 decisions on SuggestionCard placeholder

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries, 100% existing codebase patterns
- Architecture: HIGH - Direct extension of existing theme route handlers and React Query hooks
- Pitfalls: HIGH - Based on direct codebase analysis of existing patterns and edge cases
- Daily endpoint algorithm: HIGH - Straightforward scoring/sorting on existing data model
- Suggestions endpoint: HIGH - Follows exact LLM call pattern from themeClassification.ts

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (stable -- no external dependency changes expected)
