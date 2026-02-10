# Phase 8: Theme Quiz (Existing Cards) - Research

**Researched:** 2026-02-10
**Domain:** Theme-scoped quiz aggregation (backend API + iOS screen)
**Confidence:** HIGH

## Summary

Phase 8 adds the ability for users to start a quiz scoped to a specific theme, drawing from existing per-content quiz questions across all content items assigned to that theme. This is architecturally very similar to the existing topic quiz feature (`POST /api/reviews/practice/topic`), but uses the `ContentTheme` join table instead of the `Tag` relation to scope the questions.

The current codebase already has all the foundational pieces: the `practice/topic` endpoint demonstrates the pattern of aggregating cards across multiple content items, the `QuizSession` model tracks sessions, and the iOS `quiz/topic/[name].tsx` screen shows how to present a multi-content quiz. The theme quiz is essentially a re-wiring of the same pattern from tags to themes, with the added requirement of a minimum content threshold (3 items with quizzes).

**Primary recommendation:** Add a new `POST /api/reviews/practice/theme` backend endpoint that queries cards via the `ContentTheme` join table, and create an `ios/app/quiz/theme/[id].tsx` screen that reuses all existing quiz components (`QuestionCard`, `AnswerFeedback`, `QuizSummary`). Update the theme detail screen's quiz button to check the threshold and route to the new screen.

## Standard Stack

### Core (Already in project -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express.js | existing | Backend API route | Already used for all routes |
| Prisma | existing | Database queries (ContentTheme join) | Already the ORM |
| Zod | existing | Request validation | Already used in review.ts |
| React Query | existing | Data fetching hooks | Already used for all API calls |
| expo-router | existing | File-based routing | Already used for navigation |

### Supporting (Already in project)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | existing | `useQuery` for theme quiz fetch | Frontend data layer |
| zustand | existing | Not needed for this phase | State stays in React Query |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `practice/theme` endpoint | Extend `practice/topic` to accept themeId | Cleaner to keep separate -- topics use Tag relation, themes use ContentTheme join |
| New quiz screen `quiz/theme/[id]` | Reuse `quiz/topic/[name]` with params | Would conflate two different query paths; theme uses ID, topic uses name string |

**Installation:**
```bash
# No new packages required -- this phase uses only existing dependencies
```

## Architecture Patterns

### Recommended Project Structure (Changes Only)
```
backend/src/
  routes/
    review.ts            # ADD: POST /reviews/practice/theme endpoint

ios/
  app/
    quiz/
      theme/
        [id].tsx         # NEW: Theme quiz screen (copies pattern from topic/[name].tsx)
  hooks/
    useQuiz.ts           # ADD: useThemeQuiz hook
    index.ts             # ADD: export useThemeQuiz
  app/
    theme/
      [id].tsx           # MODIFY: smart quiz button with threshold check
```

### Pattern 1: Theme Quiz API Endpoint
**What:** A new `POST /api/reviews/practice/theme` endpoint that accepts a `themeId`, queries all content items via `ContentTheme` join, fetches their cards, shuffles, and returns them.
**When to use:** When user taps "Quiz" on a theme detail screen.
**Example:**
```typescript
// Source: Existing pattern from POST /reviews/practice/topic (review.ts line 521-592)
reviewRouter.post('/practice/theme', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { themeId } = req.body;
    if (!themeId) {
      return res.status(400).json({ error: 'themeId is required' });
    }
    const userId = req.user!.id;

    // Verify theme ownership
    const theme = await prisma.theme.findFirst({
      where: { id: themeId, userId },
    });
    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Find all READY contents in this theme that have quizzes
    const contents = await prisma.content.findMany({
      where: {
        userId,
        status: 'READY',
        contentThemes: {
          some: { themeId },
        },
        quizzes: {
          some: {},  // Must have at least one quiz
        },
      },
      select: { id: true, title: true },
    });

    // Enforce minimum threshold
    if (contents.length < 3) {
      return res.status(400).json({
        error: 'Not enough content with quizzes',
        contentWithQuizzes: contents.length,
        minimum: 3,
      });
    }

    const contentIds = contents.map(c => c.id);

    // Get ALL cards for these contents
    const cards = await prisma.card.findMany({
      where: {
        userId,
        quiz: {
          contentId: { in: contentIds },
        },
      },
      include: {
        quiz: {
          include: {
            content: {
              select: {
                id: true,
                title: true,
                url: true,
                platform: true,
              },
            },
          },
        },
      },
    });

    // Shuffle cards randomly
    const shuffledCards = cards.sort(() => Math.random() - 0.5);

    return res.json({
      cards: shuffledCards,
      count: shuffledCards.length,
      theme: { id: theme.id, name: theme.name, emoji: theme.emoji },
      contentCount: contents.length,
      isPractice: true,
    });
  } catch (error) {
    return next(error);
  }
});
```

### Pattern 2: Quiz Readiness Check Endpoint
**What:** A lightweight endpoint or response field that tells the iOS client whether a theme has enough quizzable content (>= 3 items with quizzes).
**When to use:** Theme detail screen needs to know if quiz button should be enabled or disabled.
**Example:**
```typescript
// Option A: Extend existing GET /themes/:id to include quizReadiness
// In the theme detail route handler, add after fetching the theme:
const contentWithQuizzes = await prisma.content.count({
  where: {
    userId,
    status: 'READY',
    contentThemes: { some: { themeId } },
    quizzes: { some: {} },
  },
});

// Return in response:
return res.json({
  theme: {
    ...themeData,
    contentCount: _count.contentThemes,
    quizReadyCount: contentWithQuizzes,
    canQuiz: contentWithQuizzes >= 3,
    tags: themeTags.map(...),
  },
  contents,
  pagination,
});
```

### Pattern 3: iOS Quiz Screen (Theme variant)
**What:** A new screen at `app/quiz/theme/[id].tsx` that follows the exact same state machine as `app/quiz/topic/[name].tsx` but calls `useThemeQuiz(themeId)` instead of `useTopicQuiz(topicName)`.
**When to use:** User navigates from theme detail to quiz.
**Example:**
```typescript
// Source: Existing pattern from app/quiz/topic/[name].tsx
// The screen is nearly identical. Key differences:
// 1. Param is id (themeId) not name (topicName)
// 2. Hook is useThemeQuiz(id) not useTopicQuiz(name)
// 3. Header shows theme emoji + name instead of topic name
// 4. "Voir le memo" links to theme memo (Phase 9) or back to theme detail

export function useThemeQuiz(themeId: string) {
  return useQuery({
    queryKey: ['quiz', 'theme', themeId],
    queryFn: async () => {
      const { data } = await api.post<ThemePracticeResponse>(
        '/reviews/practice/theme',
        { themeId }
      );
      const quiz = transformCardsToQuiz(data.cards, `theme:${themeId}`);
      return {
        ...quiz,
        theme: data.theme,
        contentCount: data.contentCount,
      };
    },
    enabled: !!themeId,
  });
}
```

### Pattern 4: Conditional Quiz Button on Theme Detail
**What:** The theme detail screen shows the "Quiz" button as enabled or disabled based on `canQuiz` from the API response.
**When to use:** Every theme detail screen render.
**Example:**
```typescript
// Source: Current theme detail screen (app/theme/[id].tsx)
// Current: Unconditional button that routes to topic quiz by name
// Updated: Conditional button based on quizReadyCount

const canQuiz = theme?.canQuiz ?? false;
const quizReadyCount = theme?.quizReadyCount ?? 0;

<View style={styles.quizButton}>
  <Button
    variant="primary"
    fullWidth
    onPress={handleStartQuiz}
    disabled={!canQuiz}
  >
    {canQuiz
      ? `Quiz ${theme?.name}`
      : `Quiz (${quizReadyCount}/3 contenus)`}
  </Button>
  {!canQuiz && (
    <Text variant="caption" color="secondary" style={styles.quizHint}>
      Il faut au moins 3 contenus avec quiz pour lancer un quiz theme.
    </Text>
  )}
</View>
```

### Anti-Patterns to Avoid
- **Fetching all content then filtering in JS:** Use Prisma's `contentThemes: { some: { themeId } }` filter in the database query, not post-fetch filtering. The content count per theme could grow large.
- **Creating a separate QuizSession model for themes:** Reuse the existing `QuizSession` model. The session already supports `contentIds` filtering. No schema change needed.
- **Duplicating quiz components:** Do NOT create separate QuestionCard/AnswerFeedback/QuizSummary for theme quizzes. They are 100% reusable.
- **Using theme name for routing:** Use theme ID for the quiz screen route (`quiz/theme/[id]`), not theme name. Names can change; IDs are stable. This differs from the topic quiz which uses name.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Card shuffling | Custom Fisher-Yates | `Array.sort(() => Math.random() - 0.5)` | Good enough for quiz randomization, already used in topic quiz |
| Quiz session tracking | New session model | Existing `QuizSession` | Already supports practice mode, `contentIds` filter, session memo |
| Quiz card format transformation | New transformer | Existing `transformCardsToQuiz()` in `useQuiz.ts` | Already handles both array and object option formats |
| Quiz UI state machine | New state management | Copy existing pattern from `quiz/topic/[name].tsx` | Proven pattern: question -> feedback -> summary states |

**Key insight:** This phase is 90% plumbing and 10% new logic. The only genuinely new thing is the threshold check. Everything else is re-wiring existing patterns from tags to themes.

## Common Pitfalls

### Pitfall 1: Theme Detail API Adds N+1 Query for Quiz Count
**What goes wrong:** Adding `quizReadyCount` to the theme detail response could cause an additional DB query on every theme detail view.
**Why it happens:** Temptation to do a separate `prisma.content.count(...)` call.
**How to avoid:** Batch the quiz readiness check into the same query that already fetches contents. Use Prisma `_count` with a filter or a single additional count query alongside the existing parallel `Promise.all`.
**Warning signs:** Slow theme detail page loads, extra round trips visible in logs.

### Pitfall 2: Not Verifying Theme Ownership
**What goes wrong:** A user could pass another user's themeId to the practice/theme endpoint and get cards from themes they don't own.
**Why it happens:** Forgetting the `userId` check on the theme lookup.
**How to avoid:** Always include `userId` in the `where` clause when looking up themes: `prisma.theme.findFirst({ where: { id: themeId, userId } })`.
**Warning signs:** Cross-user data leaks in testing.

### Pitfall 3: Quiz Button Routes to Wrong Screen
**What goes wrong:** Currently the theme detail screen routes to `quiz/topic/[name]` using the theme name. If the theme name doesn't match any tag, the topic quiz returns no results.
**Why it happens:** The interim workaround from Phase 7 (routing to topic quiz by theme name) was a temporary bridge.
**How to avoid:** Phase 8 must update `handleStartQuiz` in `app/theme/[id].tsx` to route to `quiz/theme/[id]` instead of `quiz/topic/[name]`.
**Warning signs:** "Aucun quiz" error when tapping quiz from theme detail.

### Pitfall 4: Threshold Check on Frontend Only
**What goes wrong:** If the threshold (3 items with quizzes) is only enforced on the frontend, a direct API call bypasses it.
**Why it happens:** Relying on the disabled button as the only guard.
**How to avoid:** Enforce the threshold in the backend `practice/theme` endpoint. Return a 400 with a clear error if under threshold. Frontend disables the button for UX, backend validates for security.
**Warning signs:** API returns empty quiz or broken state when called directly.

### Pitfall 5: Counting Content Items vs Content With Quizzes
**What goes wrong:** The threshold checks total content in theme (e.g., 10 items) but some may not have quizzes yet (still PENDING/TRANSCRIBING). User sees "Quiz" enabled but gets few or no questions.
**Why it happens:** Confusing `contentCount` (total content in theme) with "content items that actually have generated quizzes."
**How to avoid:** The threshold must count `content WHERE status = 'READY' AND quizzes.some({})`, not just `contentThemes.count`. The query in Pattern 2 above is correct.
**Warning signs:** Quiz button enabled but quiz shows only 1-2 questions from a single content item.

## Code Examples

### Backend: Complete practice/theme endpoint
See Pattern 1 above for the full implementation. Key Prisma query:
```typescript
// Source: Adaptation of review.ts POST /practice/topic pattern
// Key difference: Uses contentThemes join instead of tags relation
where: {
  userId,
  status: 'READY',
  contentThemes: {
    some: { themeId },   // <-- Theme scoping via join table
  },
  quizzes: {
    some: {},            // <-- Must have at least one quiz
  },
}
```

### Backend: Enriched theme detail response
```typescript
// Source: Adaptation of themes.ts GET /:id
// Add quiz readiness alongside existing content query
const [contents, total, quizReadyCount] = await Promise.all([
  prisma.content.findMany({
    where: contentWhere,
    orderBy: { capturedAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
    include: { tags: true, _count: { select: { quizzes: true } } },
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
```

### iOS: useThemeQuiz hook
```typescript
// Source: Adaptation of useQuiz.ts useTopicQuiz pattern
interface ThemePracticeResponse {
  cards: BackendCard[];
  count: number;
  theme: { id: string; name: string; emoji: string };
  contentCount: number;
}

export function useThemeQuiz(themeId: string) {
  return useQuery({
    queryKey: ['quiz', 'theme', themeId],
    queryFn: async () => {
      const { data } = await api.post<ThemePracticeResponse>(
        '/reviews/practice/theme',
        { themeId }
      );
      const quiz = transformCardsToQuiz(data.cards, `theme:${themeId}`);
      return {
        ...quiz,
        theme: data.theme,
        contentCount: data.contentCount,
      };
    },
    enabled: !!themeId,
  });
}
```

### iOS: Updated theme detail types
```typescript
// Source: Extend ThemeListItem in types/content.ts
export interface ThemeListItem {
  id: string;
  name: string;
  slug: string;
  color: string;
  emoji: string;
  contentCount: number;
  quizReadyCount: number;  // NEW: content items with generated quizzes
  canQuiz: boolean;         // NEW: quizReadyCount >= 3
  tags: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Quiz button routes to topic/[name] by theme name | Quiz button routes to quiz/theme/[id] | Phase 8 | Proper theme-scoped quiz instead of tag-name lookup hack |
| No quiz threshold check | Theme detail shows quiz readiness count | Phase 8 | Users understand when quiz will unlock |
| Topics as only quiz grouping | Themes as primary quiz grouping | Phase 8 | Themes are curated groups, better for learning |

**Deprecated/outdated:**
- `handleStartQuiz` in `app/theme/[id].tsx` currently routes to `quiz/topic/[name]` using theme name -- this must be replaced in Phase 8.

## Open Questions

1. **Memo button on theme quiz summary**
   - What we know: The existing quiz summary has an "View memo" button. For content quiz it goes to `/memo/[id]`, for topic quiz it goes to `/memo/topic/[name]`.
   - What's unclear: Phase 9 will add theme memos. In Phase 8, what should the memo button do after a theme quiz?
   - Recommendation: Route back to theme detail screen (`/theme/[id]`) until Phase 9 adds the theme memo screen. Use `memoLabel="Voir le theme"` and `hideSecondButton={true}` on QuizSummary.

2. **Question limit per theme quiz session**
   - What we know: A theme with many content items could have 30-50+ questions. The existing topic quiz has no limit (returns all cards).
   - What's unclear: Should theme quiz cap at e.g., 20 questions? Or let user answer all?
   - Recommendation: Default to a 20-question cap (randomly selected from shuffled pool) for UX. The user should not feel overwhelmed. This can be adjusted later.

3. **SM-2 tracking vs practice mode**
   - What we know: The existing topic quiz submits reviews with `rating` and `sessionId`, which updates SM-2 stats (not practice mode). The content quiz does the same.
   - What's unclear: Should theme quiz answers update SM-2 scheduling?
   - Recommendation: Yes, theme quiz should update SM-2 stats just like topic quiz does. This is real learning, not just practice. Keep consistent with existing behavior.

## Sources

### Primary (HIGH confidence)
- `backend/src/routes/review.ts` -- Complete review/quiz session API (1271 lines, all endpoints read)
- `backend/src/routes/themes.ts` -- Theme CRUD API (383 lines, all endpoints read)
- `backend/src/services/quizGeneration.ts` -- Quiz generation service (454 lines)
- `backend/prisma/schema.prisma` -- Full database schema (525 lines)
- `ios/app/quiz/topic/[name].tsx` -- Topic quiz screen (174 lines, exact template for theme quiz)
- `ios/app/quiz/[id].tsx` -- Content quiz screen (163 lines, reference pattern)
- `ios/app/theme/[id].tsx` -- Theme detail screen (179 lines, quiz button source)
- `ios/hooks/useQuiz.ts` -- Quiz hooks (205 lines, `transformCardsToQuiz` reusable)
- `ios/hooks/useThemes.ts` -- Theme hooks (127 lines, `useThemeDetail` returns ThemeDetailResponse)
- `ios/types/content.ts` -- Type definitions (107 lines)
- `ios/components/quiz/` -- QuestionCard, AnswerFeedback, QuizSummary (all reusable)

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` -- Phase 8 definition, success criteria, dependencies
- `.planning/REQUIREMENTS.md` -- QUIZ-01, QUIZ-02, QUIZ-05 requirement definitions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies, all existing code reviewed line by line
- Architecture: HIGH -- Direct adaptation of proven topic quiz pattern
- Pitfalls: HIGH -- Derived from actual code analysis, real bugs that would occur
- iOS patterns: HIGH -- Exact template screens exist and were fully read

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable -- no external dependencies, all internal code)
