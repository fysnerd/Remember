# Architecture Patterns: Theme-Based Content Organization

**Domain:** Active learning platform -- theme-based UX layer for Ankora
**Researched:** 2026-02-10
**Overall confidence:** HIGH -- based on direct codebase analysis plus verified Prisma/Expo patterns

---

## Executive Summary

Theme-based organization is an **extension layer** on top of the existing Tag system, not a replacement. Tags remain granular (AI-generated per-content labels like "react-hooks", "typescript"), while Themes are broad user-facing groupings ("Web Development", "Finance") that aggregate multiple tags and their content under human-readable categories.

The existing codebase already has a "topic" concept on iOS -- but it is simply a tag filter. The Feed screen shows tags as a 2-column grid, and tapping a tag navigates to `/topic/[name]` which filters content by that tag name. There is no dedicated Topic or Theme model in the database.

This architecture adds a proper Theme model with many-to-many content relations, a classification worker, dedicated API endpoints, and iOS screens -- all built on the existing patterns already proven in the codebase.

---

## Current Architecture (as-is)

```
[Platforms] --> [Sync Workers] --> Content (INBOX)
                                      |
                                      v
                              [Transcription Workers]
                                      |
                                      v
                                [Quiz Generation] --> Quiz --> Card
                                      |
                                      v
                                 [Auto-Tagging] --> Tag (many-to-many, implicit)
                                      |
                                      v
                              iOS "topic" screens = tag filter
                              (topic/[name].tsx filters by tag name)
```

**Key observations from codebase analysis:**

1. **Tag model is global** -- `Tag` has `@@unique([name])`, shared across all users. Content connects to tags via implicit many-to-many `@relation("ContentTags")`.

2. **Topics on iOS are just tags** -- `useTopics()` calls `GET /content/tags` which returns tags with content counts. The Feed screen renders them in a grid. Tapping navigates to `/topic/[name]`.

3. **Topic quiz and memo exist** -- `POST /reviews/practice/topic` and `GET /content/topic/:name/memo` are already implemented, querying by tag name. These patterns are directly reusable for themes.

4. **Auto-tagging worker** -- Runs every 15 min, processes 10 items per batch, uses Mistral AI to generate 3-5 French tags per content. Tags are lowercased and upserted.

5. **Quiz session system** -- `QuizSession` model already supports `tagIds` for filtering, with `mode: 'practice' | 'due'`. This needs extension for `themeIds`.

---

## Target Architecture (to-be)

```
[Platforms] --> [Sync Workers] --> Content (INBOX)
                                      |
                                      v
                              [Transcription Workers]
                                      |
                                      v
                                [Quiz Generation] --> Quiz --> Card
                                      |
                                      v
                                 [Auto-Tagging] --> Tag (granular, global)
                                      |
                                      v
                          [Theme Classification Worker]  <-- NEW (runs after auto-tagging)
                                      |
                                      v
                              Theme (per-user, many-to-many) <-- NEW MODEL
                                      |
                                      v
                          iOS: Theme screens, Theme quizzes,
                          Theme memos, Theme progress
```

---

## Component Boundaries

### New Components

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Theme model** (Prisma) | Stores theme definitions per user, many-to-many with Content | Content, User |
| **Theme classification service** | Assigns content to themes based on tag matching + LLM suggestions | Content, Tag, Theme, LLM service |
| **Theme API routes** (`/api/themes`) | CRUD, content management, theme memos, suggestions | Theme model, Content, Quiz/Card models |
| **Theme iOS screens** | Theme list, detail, quiz, memo, manage | Theme API via hooks |
| **useThemes hook** | Data fetching + cache invalidation for themes | Theme API endpoints |

### Modified Components

| Component | Modification | Impact |
|-----------|-------------|--------|
| **schema.prisma** | Add Theme model, update Content + User relations | Low -- additive migration |
| **scheduler.ts** | Add `theme-classification` cron job entry | Low -- follows existing pattern exactly |
| **content.ts routes** | Include `themes` in content detail responses | Low -- add to `include` clause |
| **review.ts routes** | Add `POST /reviews/practice/theme` and `themeIds` to session | Medium -- new endpoints mirroring existing topic pattern |
| **Content type** (iOS) | Add `themes` field to Content interface | Low -- additive |
| **Feed screen** (index.tsx) | Show themes as primary grouping, tags as secondary | Medium -- UI restructure of existing screen |
| **contentStore.ts** | Add `themeFilter` state | Low -- additive |
| **FilterBar component** | Add theme filter option | Low -- new filter chip |
| **hooks/index.ts** | Export new theme hooks | Low -- additive |

### Unchanged Components

| Component | Why Unchanged |
|-----------|--------------|
| Sync workers (YouTube, Spotify, TikTok, Instagram) | Themes are post-processing, not sync-time |
| Transcription workers (all 4) | No theme awareness needed at transcription stage |
| Quiz generation service | Generates per-content, theme quizzes aggregate existing cards |
| Auto-tagging worker | Continues producing tags; themes layer sits above |
| Auth/OAuth routes | No relation to themes |
| SM-2 algorithm (review.ts) | Card-level, theme-agnostic -- works same regardless of grouping |
| Existing topic screens | Keep functional alongside theme screens during transition |

---

## Data Model Design

### Recommended: Implicit Many-to-Many (matches existing Tag pattern)

Use Prisma's implicit many-to-many for Theme-Content because no metadata is needed on the join itself (no "added date" or "relevance score" on the relationship).

**Confidence: HIGH** -- The existing Tag-Content relation already uses implicit many-to-many (`@relation("ContentTags")`) and works well throughout the codebase.

```prisma
// ============================================================================
// Themes (User-scoped content organization)
// ============================================================================

model Theme {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  name        String                // "Web Development", "Finance", "Health"
  description String?               // Optional AI or user description
  emoji       String?   @default("folder")  // Emoji identifier for UI
  color       String?               // Hex color for visual differentiation

  // Classification rules
  tagPatterns String[]              // Tag names that map to this theme
                                    // e.g. ["react", "javascript", "typescript"]

  // Metadata
  isAutoGenerated Boolean @default(false)  // true if AI-created
  sortOrder       Int     @default(0)      // User-defined display order

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  contents    Content[] @relation("ContentThemes")

  @@unique([userId, name])
  @@index([userId])
  @@index([userId, sortOrder])
}
```

**Content model addition:**

```prisma
model Content {
  // ... all existing fields unchanged ...

  tags          Tag[]    @relation("ContentTags")      // existing
  themes        Theme[]  @relation("ContentThemes")    // NEW

  // ... rest unchanged ...
}
```

**User model addition:**

```prisma
model User {
  // ... all existing fields unchanged ...

  themes        Theme[]   // NEW

  // ... rest unchanged ...
}
```

### Key Design Decisions

**1. Themes are per-user, Tags are global**

Tags are shared across users (global `Tag` table with `@@unique([name])`). Themes are per-user (`@@unique([userId, name])`). Rationale:
- Different users consume different content mixes and organize differently
- A finance YouTuber and a coding student would never share theme structures
- Theme names can be personalized ("My Side Hustle" vs "Entrepreneuriat")
- This mirrors how every note-taking app handles folders/categories (per-user)

**2. tagPatterns for automatic classification**

The `tagPatterns String[]` field stores tag names that automatically map content to the theme. When the classification worker runs:
- Fetch user's themes with their tagPatterns
- Fetch user's content that has tags but no themes
- For each content, check if any of its tags match any theme's tagPatterns
- If match found, connect content to theme

This is deterministic and fast -- no LLM call needed for routine classification. The LLM is only used for initial theme suggestions and edge cases.

**3. Why not a ThemeTag join model?**

Considered a separate `ThemeTag` model, but `tagPatterns String[]` on Theme is simpler:
- Tag names are already unique strings
- PostgreSQL supports array containment operators (`@>`, `&&`) for efficient matching
- Avoids an extra table and join
- The list is small (5-15 tags per theme) so array storage is appropriate

**4. Why implicit over explicit many-to-many?**

- No metadata needed on the Theme-Content relationship itself
- Simpler Prisma Client API (one fewer nesting level)
- Matches the existing Tag-Content pattern exactly
- Can always migrate to explicit later if metadata needed ([Prisma docs confirm this](https://www.prisma.io/docs/orm/more/help-and-troubleshooting/implicit-to-explicit-conversion))

---

## Data Flow

### Flow 1: Theme Creation

```
User creates theme manually (name, emoji, optional tagPatterns)
  OR
AI suggests themes based on user's unclassified content
  |
  v
POST /api/themes --> Theme record created
  |
  v
If tagPatterns provided:
  Classification worker runs immediately (or on next cron cycle)
  Scans user's content for matching tags
  Connects matching content to theme
  |
  v
iOS invalidates ['themes'] query key --> UI updates
```

### Flow 2: Automatic Theme Classification (Worker)

```
1. Cron fires (every 15 min, offset from auto-tagging)
2. For each user with at least one theme:
   a. Load themes with tagPatterns
   b. Load content that has tags but no themes (take 50)
   c. For each content item:
      - Get content's tag names
      - Check intersection with each theme's tagPatterns
      - If match: prisma.theme.update({ contents: { connect: { id } } })
   d. If many unclassified items remain after matching:
      - Consider suggesting a new theme (batch, not per-content)
3. Log results via existing jobExecutionTracker
```

**Worker scheduling detail:** Run at offset minutes (e.g., `7,22,37,52 * * * *`) so it runs ~7 minutes AFTER auto-tagging (`0,15,30,45 * * * *`). This gives tags time to be applied before theme classification attempts to match them.

### Flow 3: Theme-Based Quiz

```
User taps "Quiz" on theme detail screen
  |
  v
POST /api/reviews/practice/theme { themeId }
  |
  v
Backend:
  1. Find theme, verify userId
  2. Get all Content IDs in this theme (status: READY)
  3. Get all Cards for those Contents (via Quiz -> Card)
  4. Shuffle and return (same as existing topic quiz pattern)
  |
  v
iOS renders quiz using existing QuestionCard, AnswerFeedback, QuizSummary components
(identical to quiz/topic/[name].tsx flow)
```

### Flow 4: Theme Memo

```
User taps "Memo" on theme detail screen
  |
  v
GET /api/themes/:id/memo
  |
  v
Backend:
  1. Get all theme contents with transcripts
  2. Collect individual content memos (from transcript.segments.memo)
  3. If memos exist: synthesize with LLM (same pattern as /content/topic/:name/memo)
  4. Return aggregated memo
  |
  v
iOS renders memo using existing memo display component
```

---

## API Structure

### New Routes: `/api/themes`

| Method | Route | Description | Request Body / Params |
|--------|-------|-------------|----------------------|
| GET | `/api/themes` | List user's themes with content counts | -- |
| POST | `/api/themes` | Create theme | `{ name, emoji?, color?, tagPatterns?, description? }` |
| GET | `/api/themes/:id` | Theme detail with content list | Query: `?page=1&limit=20` |
| PATCH | `/api/themes/:id` | Update theme | `{ name?, emoji?, color?, tagPatterns?, sortOrder?, description? }` |
| DELETE | `/api/themes/:id` | Delete theme (NOT content) | -- |
| POST | `/api/themes/:id/content` | Add content to theme | `{ contentIds: string[] }` |
| DELETE | `/api/themes/:id/content/:contentId` | Remove content from theme | -- |
| POST | `/api/themes/:id/reclassify` | Re-run tag matching | -- |
| GET | `/api/themes/:id/memo` | Get/generate theme memo | -- |
| GET | `/api/themes/suggestions` | AI-suggested themes | -- |
| PATCH | `/api/themes/reorder` | Bulk update sortOrder | `{ themeIds: string[] }` (order = new sortOrder) |

### Extended Existing Routes

| Route | Change | Details |
|-------|--------|---------|
| `GET /api/content` | Add `themeId` query param | Filter content by theme |
| `GET /api/content/:id` | Include `themes` in response | Add to Prisma `include` |
| `POST /api/reviews/practice/theme` | NEW endpoint | Mirror `/practice/topic` but filter by themeId |
| `POST /api/reviews/session` | Add `themeIds` to schema | Extend createSessionSchema with optional `themeIds` array |
| `GET /api/reviews` | Include theme info in response | Add themes to content select |

### Route File Structure

```typescript
// backend/src/routes/theme.ts -- NEW FILE

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';

export const themeRouter = Router();
themeRouter.use(authenticateToken);

// GET /api/themes
themeRouter.get('/', async (req, res, next) => { /* ... */ });
// POST /api/themes
themeRouter.post('/', async (req, res, next) => { /* ... */ });
// etc.
```

Registration in the main app (alongside existing routers):

```typescript
// In server.ts / app.ts
import { themeRouter } from './routes/theme.js';
app.use('/api/themes', themeRouter);
```

---

## Patterns to Follow

### Pattern 1: Worker Pattern (match existing auto-tagging worker exactly)

The theme classification worker follows the same structure as `runAutoTaggingWorker()` in `services/tagging.ts`.

```typescript
// backend/src/services/themeClassification.ts

import { prisma } from '../config/database.js';
import pLimit from 'p-limit';
import { logger } from '../config/logger.js';

const log = logger.child({ service: 'theme-classification' });

export async function runThemeClassificationWorker(): Promise<void> {
  log.info('Theme classification worker starting');

  try {
    // Get users who have themes defined
    const usersWithThemes = await prisma.user.findMany({
      where: { themes: { some: {} } },
      select: { id: true },
    });

    log.info({ userCount: usersWithThemes.length }, 'Users with themes found');

    const limit = pLimit(5);
    const results = await Promise.allSettled(
      usersWithThemes.map(user =>
        limit(() => classifyContentForUser(user.id))
      )
    );

    const classified = results.filter(r => r.status === 'fulfilled').length;
    log.info({ classified, total: usersWithThemes.length },
      'Theme classification worker completed');
  } catch (error) {
    log.error({ err: error }, 'Theme classification worker error');
  }
}

async function classifyContentForUser(userId: string): Promise<number> {
  const themes = await prisma.theme.findMany({
    where: { userId },
    select: { id: true, tagPatterns: true },
  });

  const unclassifiedContent = await prisma.content.findMany({
    where: {
      userId,
      tags: { some: {} },
      themes: { none: {} },
      status: 'READY',
    },
    include: { tags: true },
    take: 50,
  });

  let classified = 0;

  for (const content of unclassifiedContent) {
    const contentTagNames = content.tags.map(t => t.name);

    for (const theme of themes) {
      const hasMatch = theme.tagPatterns.some(pattern =>
        contentTagNames.includes(pattern)
      );

      if (hasMatch) {
        await prisma.theme.update({
          where: { id: theme.id },
          data: { contents: { connect: { id: content.id } } },
        });
        classified++;
        break; // Connect to first matching theme (avoid double-counting)
      }
    }
  }

  return classified;
}
```

**Note on the `break`:** A content item CAN belong to multiple themes. The `break` above prevents double-classification in a single worker run. On subsequent runs, if the content still has unmatched tagPatterns for other themes, it will be classified into those too. Alternative: remove the `break` to allow immediate multi-theme assignment. The choice depends on UX preference.

### Pattern 2: Scheduler Registration (match existing cron entries)

```typescript
// In scheduler.ts -- add to startScheduler() function

import { runThemeClassificationWorker } from '../services/themeClassification.js';

// Theme Classification Worker - Every 15 minutes (offset from auto-tagging)
cron.schedule('7,22,37,52 * * * *', async () => {
  log.info({ job: 'theme-classification' }, 'Triggering scheduled job');
  await runJob('theme-classification', runThemeClassificationWorker);
});

// Also add to triggerJob() switch statement:
case 'theme-classification':
  await runJob('theme-classification', runThemeClassificationWorker, triggerSource);
  return { success: true, message: 'Theme classification worker completed' };
```

### Pattern 3: React Query Hook (match existing useTopics pattern)

```typescript
// ios/hooks/useThemes.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface Theme {
  id: string;
  name: string;
  emoji: string;
  color?: string;
  description?: string;
  contentCount: number;
  isAutoGenerated: boolean;
}

export function useThemes() {
  return useQuery({
    queryKey: ['themes'],
    queryFn: async () => {
      const { data } = await api.get<Theme[]>('/themes');
      return data;
    },
  });
}

export function useThemeDetail(themeId: string) {
  return useQuery({
    queryKey: ['themes', themeId],
    queryFn: async () => {
      const { data } = await api.get(`/themes/${themeId}`);
      return data;
    },
    enabled: !!themeId,
  });
}

export function useCreateTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      emoji?: string;
      tagPatterns?: string[];
    }) => {
      const { data } = await api.post('/themes', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
    },
  });
}

export function useDeleteTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (themeId: string) => {
      const { data } = await api.delete(`/themes/${themeId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
}
```

### Pattern 4: Expo Router Screen (match existing topic/[name].tsx)

Theme screens live at top-level file routes, pushing onto the root stack -- exactly like existing topic screens.

```
ios/app/
  theme/
    [id].tsx              # Theme detail screen
    manage/[id].tsx       # Theme settings (rename, edit tags, delete)
    create.tsx            # Theme creation screen
  quiz/
    theme/[id].tsx        # Theme quiz (reuses QuestionCard components)
  memo/
    theme/[id].tsx        # Theme memo display
```

The theme detail screen mirrors `topic/[name].tsx` structure:

```typescript
// ios/app/theme/[id].tsx -- follows same pattern as topic/[name].tsx
export default function ThemeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: theme, isLoading } = useThemeDetail(id);

  const handleStartQuiz = () => {
    router.push({ pathname: '/quiz/theme/[id]', params: { id } });
  };

  const handleManageTheme = () => {
    router.push({ pathname: '/theme/manage/[id]', params: { id } });
  };

  // ... render content list, quiz button, memo button
  // Same component structure as topic/[name].tsx
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Replacing Tags with Themes

**What:** Removing the Tag model and using only Themes for all classification.
**Why bad:** Tags serve a different purpose (granular, AI-generated, per-content). The auto-tagging pipeline, the existing topic-based quiz flow, the Library FilterBar, and the `useTopics` hook all depend on tags. Removing them breaks the entire classification pipeline.
**Instead:** Keep both. Tags = raw AI classification. Themes = user-facing organization. Themes reference tags via `tagPatterns`. Content can have both tags AND themes simultaneously.

### Anti-Pattern 2: Theme Classification at Sync Time

**What:** Running theme classification inside sync workers right after content import.
**Why bad:** At sync time, content is in INBOX status with no transcript and no tags. Theme classification depends on tags, which depend on transcription. The pipeline is: sync -> transcribe -> tag -> classify into themes. Short-circuiting this creates empty themes.
**Instead:** Separate worker with time offset after auto-tagging.

### Anti-Pattern 3: Cross-User Theme Sharing (Global Themes)

**What:** Making themes global like tags, so all users share the same theme definitions.
**Why bad:** Users have wildly different content mixes. "Finance" for user A means crypto trading; for user B it means personal budgeting. Shared themes would create constant mis-classification and user frustration.
**Instead:** Themes are per-user (`@@unique([userId, name])`). AI can suggest similar structures, but each user's themes are independent.

### Anti-Pattern 4: Generating New Quiz Questions for Themes

**What:** Using LLM to create cross-content synthesis questions specifically for themes.
**Why bad:** Massively increases LLM costs (generating questions for N contents combined), requires complex prompt engineering, creates questions that cannot be attributed to a single content source (breaks the Content -> Quiz -> Card chain), and the SM-2 algorithm operates at card level regardless.
**Instead:** Theme quizzes aggregate existing per-content quiz cards. The review routes already support filtering cards by content IDs.

### Anti-Pattern 5: Deeply Nested Tab Navigation

**What:** Creating a "Themes" tab and nesting theme detail/quiz/memo screens inside it.
**Why bad:** expo-router handles file-based routing at the top level. Deep nesting inside tabs creates complex navigation state, URL ambiguity, and back-button confusion.
**Instead:** Theme screens at top-level routes (`/theme/[id]`, `/quiz/theme/[id]`) pushing onto the root stack, identical to existing `/topic/[name]` and `/quiz/topic/[name]` patterns. The [Expo Router docs](https://docs.expo.dev/router/advanced/nesting-navigators/) confirm this is the recommended approach.

### Anti-Pattern 6: Per-Content LLM Calls for Theme Classification

**What:** Calling Mistral AI for every content item to determine which theme it belongs to.
**Why bad:** Tags already exist and were generated by Mistral. Running another LLM call per content just to map tags to themes is wasteful. At 50 contents per user, that's 50 additional API calls per classification run.
**Instead:** Tag-pattern matching is deterministic and instant. Only use LLM for theme SUGGESTIONS (analyzing aggregate tag patterns to suggest new themes), not for per-content classification.

---

## Integration Points Summary

### Database Layer

| What | Type | File |
|------|------|------|
| Theme model | NEW | `prisma/schema.prisma` |
| Content themes relation | MODIFY | `prisma/schema.prisma` |
| User themes relation | MODIFY | `prisma/schema.prisma` |
| Migration | NEW | `prisma/migrations/[timestamp]_add_themes/` |

### Backend Services

| What | Type | File |
|------|------|------|
| Theme classification service | NEW | `src/services/themeClassification.ts` |
| Theme suggestion service | NEW | `src/services/themeSuggestion.ts` |
| Theme routes | NEW | `src/routes/theme.ts` |
| Scheduler cron entry | MODIFY | `src/workers/scheduler.ts` |
| Admin trigger support | MODIFY | `src/routes/admin.ts` |
| Content routes (include themes) | MODIFY | `src/routes/content.ts` |
| Review routes (theme practice) | MODIFY | `src/routes/review.ts` |
| Server route registration | MODIFY | `src/index.ts` or `src/app.ts` |

### iOS App

| What | Type | File |
|------|------|------|
| Theme interface | NEW | `ios/types/content.ts` |
| useThemes hook | NEW | `ios/hooks/useThemes.ts` |
| Hook exports | MODIFY | `ios/hooks/index.ts` |
| Theme detail screen | NEW | `ios/app/theme/[id].tsx` |
| Theme manage screen | NEW | `ios/app/theme/manage/[id].tsx` |
| Theme create screen | NEW | `ios/app/theme/create.tsx` |
| Theme quiz screen | NEW | `ios/app/quiz/theme/[id].tsx` |
| Theme memo screen | NEW | `ios/app/memo/theme/[id].tsx` |
| Feed screen | MODIFY | `ios/app/(tabs)/index.tsx` |
| contentStore | MODIFY | `ios/stores/contentStore.ts` |
| FilterBar component | MODIFY | `ios/components/content/FilterBar.tsx` |

---

## Feed Screen Transition Strategy

The Feed screen (currently `ios/app/(tabs)/index.tsx`) currently shows:
1. Tags in a 2-column grid (labeled "Topics")
2. Recent content suggestions below

**Recommended transition:**
1. Show themes as the primary grid (larger cards with emoji + name + content count)
2. Show "Uncategorized" as a special entry if content exists without themes
3. Keep recent suggestions section below
4. Add a "Create Theme" card at the end of the grid
5. Keep existing tag-based topic screens functional (no breaking change)
6. Gradually phase out raw tag display in Feed as themes become populated

This avoids a breaking change -- users with no themes see the same tag-based view, while users who create themes get the enhanced experience.

---

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Theme count per user | 3-10, no concern | Same | Same |
| Classification worker runtime | <1s/user, <2min total | Batch by user, paginate content | Queue-based, distributed workers |
| Theme query performance | Direct join, <50ms | Composite index on join table | Materialized view for stats |
| LLM calls for suggestions | On-demand only, no concern | Rate limit per user | Cache suggestions, daily batch |
| Join table size (_ContentThemes) | ~500 rows total | ~500K rows | ~50M rows, monitor index size |

### Index Strategy

Prisma's implicit many-to-many creates a `_ContentThemes` join table with indexes on both FK columns. The explicit indexes on Theme (`[userId]`, `[userId, sortOrder]`) handle the primary query patterns. At current scale this is more than sufficient.

---

## Suggested Build Order

Dependencies flow top-to-bottom. Each phase can be deployed independently.

```
Phase 1: Data Model + Migration
  - Add Theme model to schema.prisma
  - Add themes relation to Content and User
  - Run prisma migrate dev
  - Run prisma generate
  Dependencies: None
  Risk: Low (additive migration, no data changes)

Phase 2: Backend Theme CRUD API
  - Create src/routes/theme.ts
  - Register in server/app
  - Implement: list, create, get, update, delete
  - Implement: add/remove content manually
  - Include themes in GET /api/content/:id response
  Dependencies: Phase 1
  Risk: Low (new endpoints only)

Phase 3: Theme Classification Worker
  - Create src/services/themeClassification.ts
  - Register in scheduler.ts (cron + triggerJob)
  - Add to admin manual trigger list
  Dependencies: Phase 1
  Risk: Low (follows existing worker pattern)

Phase 4: iOS Theme Screens (Core)
  - Add Theme type to types/content.ts
  - Create useThemes hook
  - Create theme/[id].tsx (detail screen)
  - Create theme/manage/[id].tsx (settings)
  - Create theme/create.tsx
  - Update Feed screen to show themes
  Dependencies: Phase 2
  Risk: Medium (UI work, needs design decisions)

Phase 5: Theme Quiz + Memo
  - Add POST /reviews/practice/theme endpoint
  - Add themeIds to review session schema
  - Create quiz/theme/[id].tsx (reuse QuestionCard)
  - Add GET /themes/:id/memo endpoint
  - Create memo/theme/[id].tsx
  Dependencies: Phase 2, Phase 4
  Risk: Low (mirrors existing topic quiz/memo pattern)

Phase 6: AI Theme Suggestions
  - Create src/services/themeSuggestion.ts
  - Add GET /themes/suggestions endpoint
  - iOS suggestion UI (accept/reject/customize)
  Dependencies: Phase 3, Phase 4
  Risk: Medium (LLM prompt engineering, UX decisions)
```

---

## Sources

- [Prisma Many-to-Many Relations Documentation](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations) -- Implicit vs explicit patterns, when to use each
- [Prisma Implicit to Explicit Conversion Guide](https://www.prisma.io/docs/orm/more/help-and-troubleshooting/implicit-to-explicit-conversion) -- Migration path if metadata needed later
- [Expo Router Common Navigation Patterns](https://docs.expo.dev/router/basics/common-navigation-patterns/) -- Tabs + stack nesting best practices
- [Expo Router Nesting Navigators](https://docs.expo.dev/router/advanced/nesting-navigators/) -- File-based routing with nested layouts
- Direct codebase analysis of all relevant files:
  - `backend/prisma/schema.prisma` -- Full data model (473 lines)
  - `backend/src/workers/scheduler.ts` -- All 12 cron jobs, runJob wrapper, triggerJob dispatcher
  - `backend/src/services/tagging.ts` -- Auto-tagging worker pattern (generateTags, autoTagContent, runAutoTaggingWorker)
  - `backend/src/services/quizGeneration.ts` -- Quiz generation pipeline (processContentQuiz, generateQuizFromTranscript)
  - `backend/src/routes/content.ts` -- Content API (filters, tags, topic memo, triage)
  - `backend/src/routes/review.ts` -- Review API (due cards, sessions, topic practice, topic quiz, memos)
  - `ios/app/(tabs)/index.tsx` -- Feed screen (tag-based topics grid)
  - `ios/app/(tabs)/library.tsx` -- Library with FilterBar
  - `ios/app/topic/[name].tsx` -- Topic detail screen
  - `ios/app/quiz/topic/[name].tsx` -- Topic quiz screen
  - `ios/app/topic/manage/[name].tsx` -- Topic management
  - `ios/hooks/useTopics.ts` -- Topic hooks (useTopics, useTopicsWithCount, mutations)
  - `ios/hooks/useContent.ts` -- Content hooks (useContentList, mapContent)
  - `ios/stores/contentStore.ts` -- Zustand store (filters, tabs)
  - `ios/types/content.ts` -- TypeScript interfaces
