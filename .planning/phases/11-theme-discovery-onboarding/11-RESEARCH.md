# Phase 11: Theme Discovery & Onboarding - Research

**Researched:** 2026-02-11
**Domain:** Theme discovery onboarding flow + learning progress aggregation per theme
**Confidence:** HIGH

## Summary

Phase 11 introduces two distinct features: (1) a "discovery flow" that presents AI-generated themes to users for review before they appear in navigation, and (2) learning progress metrics on theme cards (mastery percentage and cards due for review).

Currently, the theme classification worker (`themeClassification.ts`) generates themes silently in the background via `runThemeClassificationWorker()`. When a user reaches 10+ tagged content items and has 0 themes, the worker calls `generateThemesForUser()` which creates Theme records directly in the database. These themes immediately appear on the home screen's theme grid. There is no user review step -- themes go from "AI-generated" to "visible in navigation" with zero user interaction. This phase adds that intermediate review step.

The second feature -- theme learning progress -- requires aggregating Card/Review data scoped to themes. Currently, the `GET /themes` endpoint returns `contentCount`, `quizReadyCount`, `canQuiz`, and `tags` per theme. It does NOT return any mastery or due-count data. Mastery percentage can be computed from Card records (via the ContentTheme join: Theme -> ContentTheme -> Content -> Quiz -> Card). Due count is the number of Card records where `nextReviewAt <= now()` for quizzes belonging to content in the theme.

**Primary recommendation:** Add a `discoveredAt` nullable DateTime field to the `Theme` model. When null, the theme is "pending discovery" and should not appear in the normal theme grid. The discovery flow is a full-screen modal/page that shows all pending themes and lets the user rename, merge, dismiss, or confirm them. On confirm, `discoveredAt` is set to `now()`. The backend `GET /themes` endpoint is extended with a query parameter `?status=discovered|pending|all` to filter themes. Learning progress is computed server-side via a new aggregation in the `GET /themes` endpoint (or a dedicated sub-endpoint) that counts cards due and computes mastery per theme.

## Standard Stack

### Core (Already in project -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express.js | existing | Backend API routes for discovery + progress endpoints | Already used for all routes |
| Prisma | existing | Schema migration (add `discoveredAt` to Theme) + aggregation queries | Already the ORM |
| React Query | existing | Data fetching hooks for discovery flow and progress data | Already used for `useThemes` |
| expo-router | existing | File-based routing for discovery screen | Already used for all screens |
| Zustand | existing | Local state management for discovery flow edits | Already used for auth store |
| Zod | existing | Request validation for bulk confirm/merge/rename endpoints | Already used in theme routes |

### Supporting (Already in project)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Pressable/Animated (RN core) | existing | Swipe-to-dismiss or tap interactions in discovery list | Built-in, no dependency needed |
| React Native Reanimated | check if installed | Smooth animations for card dismissal/merge | Only if already in project |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `discoveredAt` nullable field on Theme | Separate `ThemeDiscovery` model | Separate model adds complexity; a single nullable field is simpler and sufficient |
| `discoveredAt` DateTime | `status` enum (PENDING/DISCOVERED) | DateTime is more informative (when was it discovered?) and serves as both flag and timestamp |
| Server-side mastery aggregation | Client-side computation from fetched cards | Server-side is correct: client would need to fetch ALL cards per theme which is expensive and leaky |
| Single `GET /themes` with progress data | Separate `GET /themes/:id/progress` endpoint | Single endpoint avoids N+1 calls from the home screen; progress data is small (2 numbers per theme) |

**Installation:**
```bash
# No new packages required -- this phase uses only existing dependencies
```

## Architecture Patterns

### Recommended Project Structure (Changes Only)

```
backend/
  prisma/
    schema.prisma                  # MODIFY: Add discoveredAt to Theme model
    migrations/                    # NEW: Migration for discoveredAt field
  src/
    routes/
      themes.ts                    # MODIFY: Add discovery endpoints, progress aggregation
                                   #   POST /themes/discover (bulk confirm/merge/dismiss)
                                   #   GET /themes?status=discovered|pending
                                   #   Progress fields in GET /themes response

ios/
  app/
    theme-discovery.tsx            # NEW: Discovery onboarding screen (full-screen modal)
  hooks/
    useThemes.ts                   # MODIFY: Add useThemeDiscovery, useConfirmThemes hooks
    useThemeProgress.ts            # NEW (or extend useThemes): Hook for progress data
  components/
    ThemeCard.tsx                  # MODIFY: Add mastery bar and due count display
    DiscoveryThemeCard.tsx         # NEW: Editable theme card for discovery flow
  types/
    content.ts                    # MODIFY: Add progress fields to ThemeListItem
```

### Pattern 1: Discovery Flow as Gated Screen

**What:** When the backend generates themes for a user (via the cron worker), themes are created with `discoveredAt = null`. The iOS app checks for pending themes on the home screen load. If pending themes exist, the app presents a full-screen discovery flow before showing the normal home screen.

**When to use:** First time themes are generated for a user, or whenever new themes are added by the system.

**Example:**
```typescript
// In ios/app/(tabs)/index.tsx - check for pending themes
const { data: themes } = useThemes();
const { data: pendingThemes } = usePendingThemes();

// If pending themes exist, show discovery flow instead of home
if (pendingThemes && pendingThemes.length > 0) {
  router.push('/theme-discovery');
  return null; // or a loading state
}
```

### Pattern 2: Bulk Operations Endpoint

**What:** A single POST endpoint handles all discovery actions (confirm, rename, merge, dismiss) in one request, instead of requiring N individual API calls.

**When to use:** When the user finishes the discovery flow and taps "Confirm".

**Example:**
```typescript
// POST /api/themes/discover
// Request body:
{
  "actions": [
    { "type": "confirm", "themeId": "abc123" },
    { "type": "rename", "themeId": "def456", "newName": "Musique Classique" },
    { "type": "merge", "sourceThemeId": "ghi789", "targetThemeId": "abc123" },
    { "type": "dismiss", "themeId": "jkl012" }
  ]
}
// Response: { confirmedCount: 3, mergedCount: 1, dismissedCount: 1, themes: [...] }
```

### Pattern 3: Server-Side Mastery Aggregation

**What:** Mastery percentage is computed on the backend and returned as part of the theme list response. This avoids the client needing to fetch all cards per theme.

**When to use:** Every time themes are listed (home screen).

**Formula:**
```
mastery = (cards with interval >= 21 days) / (total cards in theme) * 100
```
Where interval >= 21 days means the card has been successfully reviewed multiple times and is in long-term memory. This is a pragmatic definition aligned with SM-2: after 3+ successful reviews, interval exceeds 21 days.

**Alternative formula (simpler, equally valid):**
```
mastery = (cards with repetitions >= 3 AND last rating >= GOOD) / (total cards) * 100
```

**Example SQL (for Prisma raw query):**
```sql
SELECT
  t.id AS "themeId",
  COUNT(c2.id) AS "totalCards",
  COUNT(c2.id) FILTER (WHERE c2.interval >= 21) AS "masteredCards",
  COUNT(c2.id) FILTER (WHERE c2."nextReviewAt" <= NOW()) AS "dueCards"
FROM "Theme" t
LEFT JOIN "ContentTheme" ct ON ct."themeId" = t.id
LEFT JOIN "Content" co ON co.id = ct."contentId"
LEFT JOIN "Quiz" q ON q."contentId" = co.id
LEFT JOIN "Card" c2 ON c2."quizId" = q.id AND c2."userId" = t."userId"
WHERE t."userId" = $1 AND t."discoveredAt" IS NOT NULL
GROUP BY t.id
```

### Anti-Patterns to Avoid

- **Client-side mastery calculation:** Fetching all Card records per theme to compute mastery on iOS would be slow and waste bandwidth. Always compute server-side.
- **Blocking theme generation on discovery:** The worker should still generate themes in the background. The discovery flow is a UI gate, not a generation gate. Never block the cron worker waiting for user input.
- **Individual API calls per theme action:** Making one API call per rename/merge/dismiss in the discovery flow causes N requests. Use a single bulk endpoint.
- **Showing pending themes in navigation:** Themes with `discoveredAt = null` must NOT appear in the normal theme grid or be accessible via direct URL. They are "draft" state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theme merge logic | Manual content/tag reassignment | A transaction that moves all ContentTheme + ThemeTag records from source to target, then deletes source | Edge cases: duplicate ContentTheme records, orphaned ThemeTags, slug conflicts |
| Mastery percentage | Complex client-side Card analysis | Single SQL aggregation query in the GET /themes endpoint | Performance: one query vs N+1; accuracy: consistent formula |
| Discovery flow routing guard | Custom navigation middleware | Simple check in home screen component + React Query data | Expo-router doesn't support middleware; conditional redirect is the pattern |

**Key insight:** The merge operation is the most complex part of this phase. When merging Theme A into Theme B: (1) move all ContentTheme records from A to B (skip duplicates), (2) move all ThemeTag records from A to B (skip duplicates), (3) move all synthesis Quiz records from A to B (or delete them since they'll be stale), (4) delete Theme A. This MUST be a transaction.

## Common Pitfalls

### Pitfall 1: Race Condition Between Worker and Discovery Flow

**What goes wrong:** The theme classification worker runs every 15 minutes. If a user is in the middle of the discovery flow and the worker generates new themes, the discovery list becomes stale.
**Why it happens:** The worker currently has no awareness of whether a user is actively reviewing themes.
**How to avoid:** The worker's `generateThemesForUser()` already has an idempotency check: `if existingThemeCount > 0, skip`. Since discovery themes ARE created (just with `discoveredAt = null`), the worker won't regenerate. The Stage B (content classification) only runs for users who already have themes, so it will classify content into the pending themes. This is actually correct behavior.
**Warning signs:** If the worker is modified to skip users with only pending themes, new content won't get classified.

### Pitfall 2: Empty Theme After Merge

**What goes wrong:** User merges Theme A (3 items) into Theme B (2 items), but some items overlap. Result: Theme B has fewer items than expected.
**Why it happens:** ContentTheme has a `@@unique([contentId, themeId])` constraint. When moving records, duplicates are silently skipped.
**How to avoid:** After merge, re-count and display the accurate count. Use `skipDuplicates: true` on createMany and count the actual result.
**Warning signs:** Post-merge content count doesn't match sum of pre-merge counts.

### Pitfall 3: N+1 Query for Progress Data

**What goes wrong:** Computing mastery per theme by doing a separate query for each theme's cards.
**Why it happens:** Natural Prisma pattern is `for (theme of themes) { count cards... }` which generates N queries.
**How to avoid:** Use a single raw SQL query that aggregates card data grouped by theme (see Pattern 3 above). Return progress data alongside theme list in a single response.
**Warning signs:** Home screen load time increases linearly with number of themes.

### Pitfall 4: Discovery Flow Blocks Normal Usage

**What goes wrong:** User can't access any other part of the app until they complete the discovery flow.
**Why it happens:** Implementing discovery as a hard navigation gate that prevents going back.
**How to avoid:** Make the discovery flow dismissible (user can skip and come back later). Store a "snoozed" state locally (AsyncStorage or Zustand) so it doesn't block on every app open. Alternatively, show a banner on the home screen instead of auto-navigating.
**Warning signs:** User complaints about being stuck on discovery screen.

### Pitfall 5: Mastery Formula Gives Misleading Numbers

**What goes wrong:** Theme shows 0% mastery even though user has reviewed cards, because no cards have reached the 21-day interval threshold yet.
**Why it happens:** New users take weeks to build up SM-2 intervals. Early on, all cards have short intervals.
**How to avoid:** Use a weighted formula that considers multiple signals: `masteryScore = (0.5 * cardsAboveMinInterval + 0.3 * averageEaseFactor + 0.2 * reviewCount) / totalCards`. OR use a simpler "percent reviewed at least once" for early stages and switch to interval-based mastery once enough data exists.
**Warning signs:** All theme cards show 0% mastery for the first 2-3 weeks of usage.

## Code Examples

### Backend: Discovery Endpoint (Bulk Operations)

```typescript
// POST /api/themes/discover - Bulk confirm/rename/merge/dismiss
// Source: New endpoint following existing pattern in themes.ts

const discoverSchema = z.object({
  actions: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('confirm'), themeId: z.string() }),
    z.object({ type: z.literal('rename'), themeId: z.string(), newName: z.string().min(1).max(100) }),
    z.object({ type: z.literal('merge'), sourceThemeId: z.string(), targetThemeId: z.string() }),
    z.object({ type: z.literal('dismiss'), themeId: z.string() }),
  ])),
});

themeRouter.post('/discover', async (req, res, next) => {
  const userId = req.user!.id;
  const { actions } = discoverSchema.parse(req.body);

  await prisma.$transaction(async (tx) => {
    for (const action of actions) {
      switch (action.type) {
        case 'confirm': {
          await tx.theme.update({
            where: { id: action.themeId },
            data: { discoveredAt: new Date() },
          });
          break;
        }
        case 'rename': {
          const slug = generateSlug(action.newName);
          await tx.theme.update({
            where: { id: action.themeId },
            data: { name: action.newName, slug, discoveredAt: new Date() },
          });
          break;
        }
        case 'merge': {
          // Move ContentTheme records
          const sourceContentThemes = await tx.contentTheme.findMany({
            where: { themeId: action.sourceThemeId },
          });
          for (const ct of sourceContentThemes) {
            await tx.contentTheme.upsert({
              where: { contentId_themeId: { contentId: ct.contentId, themeId: action.targetThemeId } },
              create: { contentId: ct.contentId, themeId: action.targetThemeId, assignedBy: 'merge' },
              update: {},
            });
          }
          // Move ThemeTag records
          const sourceThemeTags = await tx.themeTag.findMany({
            where: { themeId: action.sourceThemeId },
          });
          for (const tt of sourceThemeTags) {
            await tx.themeTag.upsert({
              where: { themeId_tagId: { themeId: action.targetThemeId, tagId: tt.tagId } },
              create: { themeId: action.targetThemeId, tagId: tt.tagId },
              update: {},
            });
          }
          // Delete synthesis quizzes from source (stale after merge)
          await tx.quiz.deleteMany({ where: { themeId: action.sourceThemeId, isSynthesis: true } });
          // Delete source theme
          await tx.theme.delete({ where: { id: action.sourceThemeId } });
          // Confirm target
          await tx.theme.update({
            where: { id: action.targetThemeId },
            data: { discoveredAt: new Date() },
          });
          break;
        }
        case 'dismiss': {
          // Delete theme and all join records (cascade)
          await tx.theme.delete({ where: { id: action.themeId } });
          break;
        }
      }
    }
  });

  // Return updated themes
  const themes = await prisma.theme.findMany({
    where: { userId, discoveredAt: { not: null } },
    orderBy: { name: 'asc' },
  });

  return res.json({ themes });
});
```

### Backend: Theme Progress Aggregation

```typescript
// Extend GET /themes to include progress data
// Source: Modification of existing themes.ts GET / endpoint

// After fetching themes, compute progress in a single query
const progressData = await prisma.$queryRaw<{
  themeId: string;
  totalCards: bigint;
  masteredCards: bigint;
  dueCards: bigint;
}[]>`
  SELECT
    t.id AS "themeId",
    COALESCE(COUNT(card.id), 0) AS "totalCards",
    COALESCE(COUNT(card.id) FILTER (WHERE card.interval >= 21), 0) AS "masteredCards",
    COALESCE(COUNT(card.id) FILTER (WHERE card."nextReviewAt" <= NOW()), 0) AS "dueCards"
  FROM "Theme" t
  LEFT JOIN "ContentTheme" ct ON ct."themeId" = t.id
  LEFT JOIN "Quiz" q ON q."contentId" = ct."contentId" AND q."isSynthesis" = false
  LEFT JOIN "Card" card ON card."quizId" = q.id AND card."userId" = ${userId}
  WHERE t."userId" = ${userId} AND t."discoveredAt" IS NOT NULL
  GROUP BY t.id
`;

// Merge progress into theme response
const progressMap = new Map(progressData.map(p => [
  p.themeId,
  {
    totalCards: Number(p.totalCards),
    masteredCards: Number(p.masteredCards),
    dueCards: Number(p.dueCards),
    masteryPercent: Number(p.totalCards) > 0
      ? Math.round(Number(p.masteredCards) / Number(p.totalCards) * 100)
      : 0,
  },
]));
```

### iOS: Discovery Flow Screen Structure

```typescript
// ios/app/theme-discovery.tsx
// Full-screen modal for reviewing AI-generated themes

export default function ThemeDiscoveryScreen() {
  const { data: pendingThemes } = usePendingThemes();
  const confirmThemes = useConfirmThemes();
  const [editedThemes, setEditedThemes] = useState<Map<string, EditState>>(new Map());

  // User can: rename (tap name), merge (drag onto another), dismiss (swipe away)
  // On "Confirm", send bulk actions to POST /themes/discover

  const handleConfirm = async () => {
    const actions = buildActionsFromEdits(pendingThemes, editedThemes);
    await confirmThemes.mutateAsync({ actions });
    router.replace('/(tabs)');
  };
}
```

### iOS: Enhanced ThemeCard with Progress

```typescript
// Modified ThemeCard showing mastery bar and due count
<View style={styles.content}>
  <Text style={styles.emoji}>{emoji}</Text>
  <Text variant="body" weight="medium" numberOfLines={2} style={styles.name}>
    {name}
  </Text>
  <Text variant="caption" color="secondary">
    {contentCount} contenu{contentCount !== 1 ? 's' : ''}
  </Text>
  {/* Progress bar */}
  <View style={styles.progressBarContainer}>
    <View style={[styles.progressBar, { width: `${masteryPercent}%`, backgroundColor: color }]} />
  </View>
  {/* Due badge */}
  {dueCards > 0 && (
    <View style={styles.dueBadge}>
      <Text variant="caption" style={styles.dueText}>{dueCards}</Text>
    </View>
  )}
</View>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Themes created silently by worker | Themes still created by worker (no change to generation) | Phase 11 | Worker behavior unchanged; UI adds review gate |
| No mastery data on theme cards | Server-aggregated mastery + due count | Phase 11 | Users see learning progress at a glance |
| Theme grid shows all themes | Theme grid shows only discovered themes | Phase 11 | Pending themes hidden until user reviews |

**No deprecated patterns -- this builds on existing Phase 9/10 work.**

## Schema Changes Required

### Prisma Schema Addition

```prisma
model Theme {
  id            String         @id @default(cuid())
  userId        String
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  name          String
  slug          String
  color         String         @default("#6366F1")
  emoji         String         @default("📚")
  memo          String?
  memoGeneratedAt DateTime?
  discoveredAt  DateTime?      // NEW: null = pending discovery, set = user confirmed
  contentThemes ContentTheme[]
  themeTags     ThemeTag[]
  quizzes       Quiz[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@unique([userId, slug])
  @@unique([userId, name])
  @@index([userId])
}
```

**Migration note:** Existing themes (already in production) should be backfilled with `discoveredAt = createdAt` so they don't disappear behind a discovery gate. The migration should set `discoveredAt = createdAt` for all existing Theme records.

## Data Flow

### Discovery Flow Sequence

```
1. Worker generates themes (discoveredAt = null)
2. iOS app loads home screen -> GET /themes?status=all
3. If any themes have discoveredAt = null -> redirect to /theme-discovery
4. User reviews, renames, merges, dismisses themes
5. User taps "Confirmer" -> POST /themes/discover with actions array
6. Backend processes actions in transaction, sets discoveredAt = now()
7. iOS receives updated themes, navigates to home screen
8. Home screen shows only discovered themes (discoveredAt IS NOT NULL)
```

### Progress Data Flow

```
1. iOS home screen loads -> GET /themes (includes progress fields)
2. Backend joins Theme -> ContentTheme -> Content -> Quiz -> Card
3. Aggregates: totalCards, masteredCards (interval >= 21), dueCards (nextReviewAt <= now)
4. Returns per-theme: masteryPercent, dueCards alongside existing fields
5. ThemeCard renders progress bar + due badge
```

## Open Questions

1. **Merge UX: How should merge be triggered?**
   - What we know: Merge means combining two themes (e.g., "Rap" + "Hip Hop" = one theme). Backend logic is straightforward (move records, delete source).
   - What's unclear: Should it be drag-and-drop, a multi-select + merge button, or a checkbox-based approach? Drag-and-drop on iOS lists is complex with `react-native-reanimated` and may be overkill.
   - Recommendation: Use a simpler approach -- each theme card has a "merge into..." option that opens a picker of other themes. Avoids complex gesture handling.

2. **Discovery flow trigger: redirect vs banner?**
   - What we know: When pending themes exist, user needs to see them. Two approaches: auto-redirect to discovery screen, or show a banner/card on home screen linking to discovery.
   - What's unclear: User preference for interruption level. Auto-redirect is more forceful but ensures themes get reviewed.
   - Recommendation: Use a prominent card/banner on the home screen (not a hard redirect). This is less disruptive and the user can review at their leisure. The card appears above the theme grid when pending themes exist.

3. **Mastery threshold: what counts as "mastered"?**
   - What we know: SM-2 intervals grow exponentially: day 1 -> 3 -> ~7 -> ~18 -> ~45. After 3 successful reviews, interval is typically 18+ days.
   - What's unclear: Is 21-day interval the right threshold? Too high means new users always see 0%. Too low means cards are marked "mastered" prematurely.
   - Recommendation: Use `repetitions >= 3` (card has been successfully reviewed 3+ times) as the mastery threshold instead of interval. This is more intuitive and works for early users. The backend already stores `repetitions` on the Card model.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `backend/prisma/schema.prisma` - Theme model, Card model (SM-2 fields), ContentTheme join table
- Codebase analysis: `backend/src/services/themeClassification.ts` - Current theme generation worker, Stage A/B pattern
- Codebase analysis: `backend/src/routes/themes.ts` - Existing CRUD endpoints, response format
- Codebase analysis: `ios/hooks/useThemes.ts` - Existing React Query hooks pattern
- Codebase analysis: `ios/components/ThemeCard.tsx` - Current ThemeCard UI (no progress data)
- Codebase analysis: `ios/app/(tabs)/index.tsx` - Home screen theme grid layout
- Codebase analysis: `backend/src/routes/review.ts` - Card/Review data model, SM-2 implementation
- Codebase analysis: `ios/theme.ts` - Design tokens (wireframe aesthetic, monochrome + color accents)

### Secondary (MEDIUM confidence)
- Phase 10 research (`10-RESEARCH.md`) - Prior decisions on Quiz model changes (themeId, isSynthesis, nullable contentId)
- Phase context (from objective) - Prior decisions on theme cap (15-25), ThemeCard color bar accent, 10+ content threshold

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all patterns already established in codebase
- Architecture: HIGH - Discovery flow is a standard gated-screen pattern; progress aggregation is a single SQL join
- Pitfalls: HIGH - Based on direct analysis of existing schema constraints and worker behavior
- Schema changes: HIGH - Single nullable field addition with straightforward migration

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (stable -- no external dependencies that change rapidly)
