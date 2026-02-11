# Phase 9: Theme Memo - Research

**Researched:** 2026-02-11
**Domain:** AI-powered synthesis memo for themes (backend caching + LLM aggregation + iOS screen)
**Confidence:** HIGH

## Summary

Phase 9 adds the ability for users to view an AI-generated synthesis memo that aggregates knowledge from all content items within a theme. The codebase already has two very close precedents: (1) the per-content memo (`GET /api/content/:id/memo`) which generates and caches a memo from a single transcript, and (2) the topic memo (`GET /api/content/topic/:name/memo`) which aggregates individual content memos into a synthesis. The theme memo is essentially the topic memo pattern but scoped via the `ContentTheme` join table instead of the `Tag` relation, with the critical addition of **server-side caching with 24h TTL** (the topic memo generates fresh every time with no caching).

The existing per-content memos are cached in `transcript.segments.memo` (a JSON field). For theme memos, the cleanest approach is to add two new fields directly to the `Theme` model: `memo` (String, nullable) and `memoGeneratedAt` (DateTime, nullable). This avoids the awkward JSON-in-segments hack used for per-content memos and gives clean Prisma-level access for TTL checking. The endpoint checks `memoGeneratedAt` against current time minus 24 hours -- if cached and fresh, return immediately. If stale or missing, collect individual content memos, call the LLM for synthesis, cache the result, and return it.

The iOS screen follows the exact same pattern as `ios/app/memo/topic/[name].tsx`: Markdown rendering with `react-native-markdown-display`, share button, and generation timestamp. A "Memo" button is added to the theme detail screen alongside the existing "Quiz" button. A force-refresh mechanism (either a button or pull-to-refresh) allows regeneration.

**Primary recommendation:** Add `memo` and `memoGeneratedAt` fields to the `Theme` Prisma model. Create a `GET /api/themes/:id/memo` endpoint on the existing `themeRouter` that implements generate-on-first-view with 24h cache TTL. Add a `POST /api/themes/:id/memo/refresh` endpoint for force-refresh. Create `ios/app/memo/theme/[id].tsx` screen and a `useThemeMemo` hook. Add a "Memo" button to the theme detail screen.

## Standard Stack

### Core (Already in project -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express.js | existing | Backend API routes | Already used for all routes |
| Prisma | existing | Database queries + schema | Already the ORM; `Theme` model gets 2 new fields |
| Mistral AI | existing | LLM synthesis generation | Already integrated via `llm.ts` service |
| React Query | existing | Data fetching hooks | Already used for all API calls |
| expo-router | existing | File-based routing for memo screen | Already used for navigation |
| react-native-markdown-display | existing | Markdown rendering | Already used in `memo/[id].tsx` and `memo/topic/[name].tsx` |

### Supporting (Already in project)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | existing | Request validation (optional query params) | Validate refresh request body if any |
| pino (logger) | existing | Structured logging for memo generation | Log cache hits/misses and LLM calls |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `Theme.memo` field in DB | Store in JSON column like per-content memos | Dedicated column is cleaner, easier to query TTL, no JSON hacks |
| `GET /api/themes/:id/memo` on themeRouter | `GET /api/content/theme/:id/memo` on contentRouter | Theme memo is a theme feature, belongs on themeRouter |
| Server-side 24h TTL | Client-side React Query staleTime | Server-side is the requirement; client staleTime is additive optimization |

**Installation:**
```bash
# No new packages required -- this phase uses only existing dependencies
```

## Architecture Patterns

### Recommended Project Structure (Changes Only)
```
backend/
  prisma/
    schema.prisma           # MODIFY: Add memo + memoGeneratedAt to Theme model
  src/
    routes/
      themes.ts             # MODIFY: Add GET /:id/memo and POST /:id/memo/refresh
    services/
      themeMemo.ts           # NEW: Theme memo generation logic (optional, could inline)

ios/
  app/
    memo/
      theme/
        [id].tsx            # NEW: Theme memo screen (follows topic/[name].tsx pattern)
    theme/
      [id].tsx              # MODIFY: Add "Memo" button alongside Quiz button
  hooks/
    useMemo.ts              # MODIFY: Add useThemeMemo hook
    index.ts                # MODIFY: Export useThemeMemo
```

### Pattern 1: Generate-on-First-View with Server-Side Cache TTL

**What:** The memo is NOT pre-generated. When user first taps "Memo", the API checks if a cached memo exists and is less than 24h old. If yes, return it immediately. If no, generate via LLM, cache in the `Theme` row, and return.

**When to use:** Theme memo endpoint (`GET /api/themes/:id/memo`).

**Example:**
```typescript
// Source: Pattern derived from existing content memo (content.ts line 1140-1213)
// and topic memo (content.ts line 1280-1351), with added TTL caching

const MEMO_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

themeRouter.get('/:id/memo', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const themeId = req.params.id;

    const theme = await prisma.theme.findFirst({
      where: { id: themeId, userId },
    });

    if (!theme) return res.status(404).json({ error: 'Theme not found' });

    // Check cache: memo exists and is less than 24h old
    if (theme.memo && theme.memoGeneratedAt) {
      const age = Date.now() - new Date(theme.memoGeneratedAt).getTime();
      if (age < MEMO_TTL_MS) {
        return res.json({
          memo: theme.memo,
          generatedAt: theme.memoGeneratedAt,
          contentCount: /* count from join table */,
          cached: true,
        });
      }
    }

    // Generate: collect individual content memos, synthesize via LLM
    const contentMemos = await collectContentMemosForTheme(themeId, userId);

    if (contentMemos.length === 0) {
      return res.status(400).json({
        error: 'No memos available yet for content in this theme.',
        hint: 'Content memos are generated when quiz processing completes.',
      });
    }

    const synthesized = await generateThemeSynthesis(theme.name, contentMemos);

    // Cache in Theme row
    await prisma.theme.update({
      where: { id: themeId },
      data: { memo: synthesized, memoGeneratedAt: new Date() },
    });

    return res.json({
      memo: synthesized,
      generatedAt: new Date().toISOString(),
      contentCount: contentMemos.length,
      cached: false,
    });
  } catch (error) {
    return next(error);
  }
});
```

### Pattern 2: Force-Refresh Endpoint

**What:** A separate POST endpoint that bypasses the cache and regenerates the memo.

**When to use:** When user explicitly requests a refresh (e.g., after adding new content to the theme).

**Example:**
```typescript
// Source: Pattern from POST /api/content/:id/memo/regenerate (content.ts line 1215-1278)

themeRouter.post('/:id/memo/refresh', async (req, res, next) => {
  // Same as GET but always regenerates, ignoring cache
  // Update theme.memo and theme.memoGeneratedAt
  // Return { memo, generatedAt, contentCount, regenerated: true }
});
```

### Pattern 3: Content Memo Collection via ContentTheme Join

**What:** Query all content items in a theme that have memos available, collect their individual memos for aggregation.

**When to use:** As input for the synthesis LLM call.

**Example:**
```typescript
// Source: Pattern from topic memo (content.ts line 1286-1312)
// adapted to use ContentTheme join instead of Tag relation

async function collectContentMemosForTheme(
  themeId: string,
  userId: string
): Promise<{ title: string; memo: string }[]> {
  const contents = await prisma.content.findMany({
    where: {
      userId,
      status: 'READY',
      contentThemes: { some: { themeId } },
    },
    include: {
      transcript: true,
    },
  });

  const memos: { title: string; memo: string }[] = [];
  for (const content of contents) {
    const meta = content.transcript?.segments as any;
    if (meta?.memo) {
      memos.push({ title: content.title, memo: meta.memo });
    }
  }
  return memos;
}
```

### Pattern 4: iOS Memo Screen with Markdown Rendering

**What:** A new screen at `ios/app/memo/theme/[id].tsx` that renders the memo markdown.

**When to use:** When user taps "Memo" on theme detail.

**Example:**
```typescript
// Source: Exact pattern from ios/app/memo/topic/[name].tsx
// Uses: react-native-markdown-display, Share, useThemeMemo hook
// Same markdownStyles object (reuse from topic memo screen)

export default function ThemeMemoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: memo, isLoading, error, refetch } = useThemeMemo(id!);
  // ... rest follows topic memo pattern exactly
}
```

### Anti-Patterns to Avoid

- **Generating theme memo on content change:** Do NOT trigger memo regeneration when content is added/removed from a theme. The 24h TTL handles staleness; regeneration is expensive (LLM call). Let users force-refresh when they want.
- **Storing memo in JSON segments:** The per-content memo stores in `transcript.segments.memo` -- this is a workaround because Content doesn't have a dedicated memo field. For themes, use proper Prisma fields on the Theme model.
- **Concatenating memos without synthesis:** The topic memo endpoint already uses LLM synthesis (not concatenation). The theme memo must follow the same approach -- synthesize across contents, find connections, organize logically.
- **Generating memo if no individual memos exist:** If content items in the theme don't have per-content memos yet (quiz generation not complete), return an error with a helpful message rather than generating from raw transcripts (which would be slow and expensive).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering | Custom parser/renderer | `react-native-markdown-display` | Already used in 2 memo screens, handles all formatting |
| LLM text generation | Direct fetch to Mistral API | `generateText()` from `services/llm.ts` | Already handles provider abstraction, retries, error handling |
| Rate limiting LLM calls | Manual throttling | `llmLimiter` from `utils/rateLimiter.ts` | Already configured for Mistral (5 concurrent) |
| Cache invalidation scheduling | Custom cron job | 24h TTL check at read time | Lazy invalidation is simpler and sufficient |

**Key insight:** Every building block needed for this phase already exists in the codebase. The per-content memo provides the generation pattern, the topic memo provides the aggregation/synthesis pattern, and the theme detail screen provides the navigation entry point. This phase is fundamentally a re-wiring of existing patterns with the addition of proper server-side caching.

## Common Pitfalls

### Pitfall 1: No Individual Content Memos Available
**What goes wrong:** User taps "Memo" on a theme but none of the content items have their per-content memos generated yet (memos are generated as part of quiz generation in `processContentQuiz`).
**Why it happens:** Content may be in READY state with quizzes but the memo generation step failed silently (it's a non-blocking post-quiz step in `processContentQuiz`).
**How to avoid:** Check the count of content items with available memos before calling the LLM. If zero, return a 400 with a clear message. If only some have memos, proceed with what's available but include the count in the response.
**Warning signs:** The `memo` field in `transcript.segments` is null for content items that should have it.

### Pitfall 2: LLM Token Limit with Many Content Items
**What goes wrong:** A theme with 20+ content items generates a very long prompt (each content memo is 200-400 words), exceeding LLM context window or generating unreliable output.
**Why it happens:** The Mistral API has a token limit per request. The existing topic memo doesn't handle this because topics typically have fewer items.
**How to avoid:** Cap the number of content memos included in the synthesis prompt. Use the most recent 15-20 memos. Truncate individual memos if total would exceed ~6000 characters. The `generateText` function uses maxTokens: 2000 by default which is fine for output but input needs guarding.
**Warning signs:** LLM returns truncated or incoherent responses, or API errors about token limits.

### Pitfall 3: Schema Migration on Production
**What goes wrong:** Adding `memo` and `memoGeneratedAt` to the Theme model requires a `prisma db push` on the VPS.
**Why it happens:** New nullable fields are additive and safe, but the push step must not be forgotten.
**How to avoid:** These are nullable fields with no default required -- `prisma db push` will add them as NULL columns without data loss. Follow the established pattern: `git pull && npx prisma db push && npx prisma generate && npm run build && pm2 restart remember-api`.
**Warning signs:** TypeScript compilation errors about unknown fields on Theme.

### Pitfall 4: Cache Invalidation on Theme Content Changes
**What goes wrong:** User adds new content to a theme, but the cached memo doesn't reflect it.
**Why it happens:** The 24h TTL means the memo could be stale if content was recently added.
**How to avoid:** The force-refresh endpoint handles this. Optionally, when content is added/removed from a theme, clear the cached memo (set `memo = null`) so the next view triggers regeneration. This is a lightweight DB update, not an expensive LLM call.
**Warning signs:** User sees a memo that doesn't mention content they just added.

### Pitfall 5: Concurrent Memo Generation Requests
**What goes wrong:** Two simultaneous requests to `GET /themes/:id/memo` both find no cache and both trigger LLM generation.
**Why it happens:** No locking mechanism on memo generation.
**How to avoid:** This is low-risk for a single-user app (unlikely to double-tap). For safety, after generating, use `updateMany` with a `where` clause that checks `memoGeneratedAt` is still null (optimistic concurrency). Alternatively, accept the rare double-generation -- it's idempotent and the second write just overwrites with a similar result.
**Warning signs:** Double LLM charges for the same theme (minor cost impact with Mistral).

## Code Examples

### LLM Synthesis Prompt (Adapted from Topic Memo)

```typescript
// Source: Adapted from content.ts line 1322-1338 (topic memo prompt)
// Key change: "theme" instead of "topic", and references theme name

function buildSynthesisPrompt(
  themeName: string,
  contentMemos: { title: string; memo: string }[]
): { system: string; user: string } {
  const memosText = contentMemos
    .map(cm => `**${cm.title}**\n${cm.memo}`)
    .join('\n\n---\n\n');

  const system = `Tu es un assistant d'apprentissage expert. A partir des memos individuels fournis, cree un memo de synthese pour le theme "${themeName}".
Le memo doit:
- Synthetiser les points cles communs et complementaires
- Organiser les concepts de maniere logique et hierarchique
- Etre structure en sections avec des bullet points
- Mettre en evidence les connexions entre les differents contenus
- Faire maximum 400 mots
- Etre entierement en francais`;

  const user = `Theme: ${themeName}
Nombre de contenus: ${contentMemos.length}

Memos individuels:
${memosText}

Genere un memo de synthese pour ce theme.`;

  return { system, user };
}
```

### Theme Schema Addition

```prisma
// Source: Existing Theme model in schema.prisma (line 377-393)
// Add two nullable fields for memo caching

model Theme {
  id            String         @id @default(cuid())
  userId        String
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  name          String
  slug          String
  color         String         @default("#6366F1")
  emoji         String         @default("📚")
  memo          String?        // Cached synthesis memo (nullable, generated on demand)
  memoGeneratedAt DateTime?    // When memo was last generated (for 24h TTL)
  contentThemes ContentTheme[]
  themeTags     ThemeTag[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@unique([userId, slug])
  @@unique([userId, name])
  @@index([userId])
}
```

### useThemeMemo Hook

```typescript
// Source: Pattern from useMemo.ts (useTopicMemo hook)

interface ThemeMemoResponse {
  memo: string;
  themeName: string;
  contentCount: number;
  generatedAt: string;
  cached: boolean;
}

export function useThemeMemo(themeId: string) {
  return useQuery({
    queryKey: ['memo', 'theme', themeId],
    queryFn: async () => {
      const { data } = await api.get<ThemeMemoResponse>(
        `/themes/${themeId}/memo`
      );
      return {
        themeId,
        themeName: data.themeName,
        content: data.memo,
        contentCount: data.contentCount,
        generatedAt: data.generatedAt,
        cached: data.cached,
      };
    },
    enabled: !!themeId,
  });
}

export function useRefreshThemeMemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (themeId: string) => {
      const { data } = await api.post<ThemeMemoResponse>(
        `/themes/${themeId}/memo/refresh`
      );
      return data;
    },
    onSuccess: (_, themeId) => {
      queryClient.invalidateQueries({ queryKey: ['memo', 'theme', themeId] });
    },
  });
}
```

### Theme Detail Screen - Adding Memo Button

```typescript
// Source: Existing theme/[id].tsx (line 124-141)
// Add a "Memo" button below or alongside the Quiz button

const handleViewMemo = () => {
  if (id) {
    router.push({
      pathname: '/memo/theme/[id]' as any,
      params: { id },
    });
  }
};

// In the JSX, alongside the quiz button:
<Button
  variant="primary"
  fullWidth
  onPress={handleViewMemo}
  disabled={!canQuiz} // Same threshold: need content with memos
>
  Memo {theme?.name}
</Button>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No caching for topic memos | Theme memos get server-side 24h cache | This phase | Avoids redundant LLM calls, faster subsequent loads |
| Memo stored in JSON field (`transcript.segments.memo`) | Theme memo stored in dedicated Prisma fields | This phase | Cleaner schema, proper DateTime for TTL checks |
| No aggregation across content | Topic memo does aggregation | Phase 7+ | Foundation for theme memo synthesis |

**Deprecated/outdated:**
- Nothing deprecated -- all existing memo patterns continue to work unchanged.

## Open Questions

1. **Should adding/removing content from a theme invalidate the cached memo?**
   - What we know: 24h TTL handles gradual staleness. Force-refresh handles explicit user need.
   - What's unclear: Whether the UX should proactively clear the cache when content changes.
   - Recommendation: Clear `memo = null` when content is added/removed from a theme (lightweight DB update in existing `POST /:id/content` and `DELETE /:id/content/:contentId` endpoints). This way the next memo view triggers fresh generation without requiring user to know about the refresh button.

2. **Should the memo button be disabled if no content has memos?**
   - What we know: The endpoint returns 400 if no content memos are available.
   - What's unclear: Whether to check this on the theme detail screen (extra API call) or handle it as an error state on the memo screen.
   - Recommendation: Let the user tap the button, show a friendly error state on the memo screen if no memos are available. This avoids an extra API call on theme detail load.

3. **Maximum content memo count for synthesis prompt?**
   - What we know: Mistral `mistral-medium-latest` has a 32K token context window.
   - What's unclear: Exact per-memo token count varies.
   - Recommendation: Cap at 15 content memos in the synthesis prompt. Each individual memo is roughly 200-400 words (~300-600 tokens). 15 memos = ~4500-9000 tokens input, well within limits. Sort by most recent `capturedAt`.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `backend/prisma/schema.prisma` -- Theme model structure, existing fields
- Codebase analysis: `backend/src/routes/themes.ts` -- All existing theme endpoints (CRUD + content management)
- Codebase analysis: `backend/src/routes/content.ts` lines 1140-1351 -- Per-content memo, topic memo endpoints
- Codebase analysis: `backend/src/services/quizGeneration.ts` lines 215-254 -- `generateMemoFromTranscript` function
- Codebase analysis: `backend/src/services/llm.ts` -- `generateText` helper, Mistral integration
- Codebase analysis: `backend/src/services/themeClassification.ts` -- Theme generation patterns, LLM usage
- Codebase analysis: `ios/app/memo/topic/[name].tsx` -- Topic memo screen (direct template for theme memo)
- Codebase analysis: `ios/app/memo/[id].tsx` -- Content memo screen (markdown rendering pattern)
- Codebase analysis: `ios/app/theme/[id].tsx` -- Theme detail screen (where memo button goes)
- Codebase analysis: `ios/hooks/useMemo.ts` -- `useTopicMemo` hook (template for `useThemeMemo`)
- Codebase analysis: `ios/hooks/useThemes.ts` -- Theme hooks pattern

### Secondary (MEDIUM confidence)
- Project deployment history: `prisma db push` is the established schema deployment method (no migrations directory)
- Mistral API context window: 32K tokens for `mistral-medium-latest` (from training data, verified by existing usage in codebase with 8000-char transcript limits)

### Tertiary (LOW confidence)
- None -- all findings are from codebase analysis with HIGH confidence.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Zero new dependencies, all libraries already in use
- Architecture: HIGH -- Direct adaptation of 2 existing patterns (topic memo + content memo)
- Schema change: HIGH -- Additive nullable fields, well-established `prisma db push` workflow
- Pitfalls: HIGH -- Identified from existing codebase patterns and known limitations
- LLM prompt: MEDIUM -- Adapted from working topic memo prompt, may need tuning for longer themes

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (stable -- no external dependencies changing)
