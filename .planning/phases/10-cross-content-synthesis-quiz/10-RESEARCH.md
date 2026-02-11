# Phase 10: Cross-Content Synthesis Quiz - Research

**Researched:** 2026-02-11
**Domain:** AI-generated synthesis quiz questions connecting concepts across multiple content items within a theme
**Confidence:** HIGH

## Summary

Phase 10 adds AI-generated "synthesis questions" to the existing theme quiz flow. These questions are distinct from single-content questions because they explicitly require knowledge spanning 2+ different content sources within a theme. The current theme quiz endpoint (`POST /api/reviews/practice/theme`) aggregates existing per-content quiz questions into a mixed deck -- it does NOT generate new questions. Phase 10 introduces a new category of questions that are generated from cross-content memos and are tagged as synthesis questions so users can visually distinguish them.

The codebase already provides all the building blocks needed. The `generateQuizFromTranscript()` function in `quizGeneration.ts` shows the established LLM prompt pattern for generating quiz questions (JSON output, Bloom's taxonomy, French, 4 options with plausible distractors). The theme memo system (Phase 9) already aggregates per-content memos into a synthesized text via `GET /api/themes/:id/memo`. The key insight is that synthesis question generation should consume the **individual content memos** (not the synthesized theme memo), because the prompt needs to know which concepts come from which content item in order to craft questions that provably span multiple sources.

The main architectural decision is where to store synthesis questions. The current `Quiz` model has a required `contentId` foreign key, tying each quiz to a single content item. Synthesis questions by definition span multiple content items. Two approaches exist: (A) add a nullable `themeId` to the `Quiz` model and make `contentId` nullable to allow theme-scoped questions, or (B) create a new `SynthesisQuiz` model dedicated to cross-content questions. Approach A is simpler and allows reusing the entire existing quiz/card/review pipeline. Approach B is cleaner semantically but requires duplicating the card/review system. **Recommendation: Approach A** -- modify the `Quiz` model to support both content-scoped and theme-scoped questions, with a new `isSynthesis` boolean flag for visual distinction.

**Primary recommendation:** Add `themeId` (nullable FK) and `isSynthesis` (boolean, default false) to the `Quiz` model, make `contentId` nullable. Create a new service function `generateSynthesisQuestions()` that takes per-content memos with attribution and generates questions requiring cross-content knowledge. Extend the theme quiz endpoint to include synthesis questions alongside existing per-content questions. Add visual distinction (badge/label) to the iOS quiz UI for synthesis questions.

## Standard Stack

### Core (Already in project -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express.js | existing | Backend API routes for theme quiz endpoints | Already used for all routes |
| Prisma | existing | Database schema changes + queries | Already the ORM; `Quiz` model gets new fields |
| Mistral AI (mistral-medium-latest) | existing | LLM synthesis question generation | Already integrated via `llm.ts` for all quiz generation |
| React Query | existing | Data fetching hooks for quiz data | Already used for `useThemeQuiz` hook |
| expo-router | existing | File-based routing | Already used for quiz screens |
| Zod | existing | Request validation | Already used in review and theme routes |

### Supporting (Already in project)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| p-limit | existing | Concurrency control for LLM calls | Rate limiting synthesis generation |
| pino (logger) | existing | Structured logging | Log synthesis generation metrics |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Modifying `Quiz` model (add themeId) | New `SynthesisQuiz` model | Separate model is cleaner but duplicates entire card/review/SM-2 pipeline; reusing Quiz is pragmatic |
| `isSynthesis` boolean on Quiz | `quizScope` enum (CONTENT/THEME) | Boolean is simpler; enum is overkill for a binary distinction |
| Nullable `contentId` on Quiz | `sourceContentIds` JSON array | JSON array lacks FK integrity; nullable contentId with themeId is cleaner |
| Generate-on-demand (when user starts theme quiz) | Background worker pre-generation | On-demand is simpler, avoids stale questions, and aligns with the quiz start flow |

**Installation:**
```bash
# No new packages required -- this phase uses only existing dependencies
```

## Architecture Patterns

### Recommended Project Structure (Changes Only)
```
backend/
  prisma/
    schema.prisma                # MODIFY: Add themeId, isSynthesis to Quiz; make contentId nullable
  src/
    services/
      quizGeneration.ts          # MODIFY: Add generateSynthesisQuestions() function
    routes/
      review.ts                  # MODIFY: Extend POST /practice/theme to include synthesis questions
      themes.ts                  # MODIFY: Add POST /:id/synthesis-quiz/generate (optional trigger)

ios/
  app/
    quiz/
      theme/
        [id].tsx                 # MODIFY: Show synthesis badge on cross-content questions
  components/
    quiz/
      QuestionCard.tsx           # MODIFY: Accept isSynthesis prop, show visual distinction
  hooks/
    useQuiz.ts                   # MODIFY: Extend useThemeQuiz to pass synthesis flag
  types/
    content.ts                   # MODIFY: Add isSynthesis to Question type
```

### Pattern 1: Synthesis Question Generation from Content Memos with Attribution

**What:** A new LLM prompt that takes individual content memos with their titles/sources and generates questions that provably require knowledge from 2+ different sources. Each generated question includes `sourceContentIds` metadata indicating which content items it draws from.

**When to use:** When user starts a theme quiz (on-demand) or when explicitly triggered.

**Example:**
```typescript
// Source: Pattern derived from generateQuizFromTranscript() in quizGeneration.ts
// Key difference: input is multiple content memos, not a single transcript

interface SynthesisQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  sourceContentIds: string[];  // IDs of the 2+ content items this question spans
}

async function generateSynthesisQuestions(
  themeName: string,
  contentMemos: { id: string; title: string; memo: string }[],
  maxQuestions: number = 5
): Promise<SynthesisQuestion[]> {
  if (contentMemos.length < 2) return []; // Need 2+ sources

  const memosText = contentMemos
    .map((cm, i) => `[Source ${i + 1}: "${cm.title}"]\n${cm.memo}`)
    .join('\n\n---\n\n');

  const prompt = `A partir de ces memos de contenus du theme "${themeName}", genere ${maxQuestions} questions de quiz de SYNTHESE.

REGLE CRITIQUE: Chaque question DOIT necessiter des connaissances issues d'AU MOINS 2 sources differentes pour etre repondue correctement. Une question de synthese met en relation des concepts, compare des idees, ou identifie des connexions entre contenus differents.

${memosText}

Pour chaque question, indique les numeros des sources utilisees.

Format JSON:
{
  "questions": [
    {
      "question": "...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctAnswer": "A",
      "explanation": "...",
      "sourceIndices": [1, 3]
    }
  ]
}`;

  // Call LLM, parse response, map sourceIndices back to contentIds
}
```

### Pattern 2: Extending Quiz Model for Theme-Scoped Questions

**What:** Make `contentId` nullable on the `Quiz` model and add a `themeId` FK. Synthesis questions have `themeId` set and `contentId` null. Add `isSynthesis` boolean for easy filtering.

**When to use:** Schema migration for Phase 10.

**Example:**
```prisma
model Quiz {
  id          String   @id @default(cuid())
  contentId   String?  // Nullable: null for synthesis questions
  content     Content? @relation(fields: [contentId], references: [id], onDelete: Cascade)
  themeId     String?  // Set for synthesis questions, null for single-content
  theme       Theme?   @relation(fields: [themeId], references: [id], onDelete: Cascade)
  isSynthesis Boolean  @default(false) // Visual flag for UI distinction

  question    String
  type        QuizType
  options     Json
  correctAnswer String
  explanation String?

  createdAt   DateTime @default(now())
  cards       Card[]

  @@index([contentId])
  @@index([themeId])
}
```

### Pattern 3: Mixed Theme Quiz Deck (Content + Synthesis Questions)

**What:** When user starts a theme quiz, the backend returns a mixed deck: existing per-content questions plus newly generated (or cached) synthesis questions. Synthesis questions are shuffled into the deck but visually tagged.

**When to use:** `POST /api/reviews/practice/theme` endpoint modification.

**Example:**
```typescript
// In review.ts POST /practice/theme handler:

// 1. Get existing per-content cards (current behavior)
const contentCards = await prisma.card.findMany({
  where: {
    userId,
    quiz: { contentId: { in: contentIds } },
  },
  include: { quiz: { include: { content: true } } },
});

// 2. Get or generate synthesis cards for this theme
let synthesisCards = await prisma.card.findMany({
  where: {
    userId,
    quiz: { themeId, isSynthesis: true },
  },
  include: { quiz: true },
});

if (synthesisCards.length === 0 && contentMemos.length >= 2) {
  // Generate synthesis questions on-demand
  synthesisCards = await generateAndStoreSynthesisQuestions(themeId, userId);
}

// 3. Mix and shuffle, cap at 20
const allCards = [...contentCards, ...synthesisCards]
  .sort(() => Math.random() - 0.5)
  .slice(0, 20);
```

### Pattern 4: Visual Distinction on iOS

**What:** Synthesis questions display a small badge/label to inform the user they are testing cross-content understanding. The `QuestionCard` component accepts an `isSynthesis` prop that conditionally renders a label.

**When to use:** When rendering quiz questions in the theme quiz screen.

**Example:**
```typescript
// In QuestionCard.tsx:
interface QuestionCardProps {
  question: string;
  options: Option[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
  correctId?: string;
  isSynthesis?: boolean;  // NEW: visual distinction for synthesis questions
}

// Inside the render, before the question text:
{isSynthesis && (
  <View style={styles.synthesisBadge}>
    <Text variant="caption" color="inverse" style={styles.synthesisBadgeText}>
      Synthese
    </Text>
  </View>
)}
```

### Anti-Patterns to Avoid

- **Using the synthesized theme memo as the sole input for question generation:** The theme memo (Phase 9) is a high-level synthesis. It loses attribution of which concept came from which content. The synthesis question prompt needs individual content memos WITH titles so it can generate questions that provably span multiple sources and include `sourceContentIds`.
- **Generating synthesis questions in a background worker:** Unlike per-content quiz generation, synthesis questions should be generated on-demand when the user starts a theme quiz. Background generation would produce stale questions when theme content changes.
- **Making a separate quiz flow for synthesis questions:** Synthesis questions should be mixed INTO the existing theme quiz flow, not a separate "synthesis quiz" mode. This gives users a natural learning experience that blends recall of individual content with cross-content connection building.
- **Over-generating synthesis questions:** Cap synthesis questions at 5 per theme quiz session. More than 5 synthesis questions (out of 20 total) would be overwhelming and detract from the per-content recall practice.
- **Storing synthesis questions ephemerally:** Synthesis questions should be persisted in the database (not generated fresh each time) so they get proper SM-2 spaced repetition scheduling via the Card/Review system. Regeneration should only happen when explicitly requested or when theme content changes significantly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Quiz question format | Custom question structure | Existing `Quiz` model + `QuizType` enum | Already has options, correctAnswer, explanation -- just add themeId and isSynthesis |
| SM-2 scheduling for synthesis | Separate spaced repetition logic | Existing `Card` + `Review` models | Synthesis questions get Cards just like regular questions -- full SM-2 pipeline reuse |
| LLM call management | Direct fetch to Mistral | `getLLMClient().chatCompletion()` + `llmLimiter()` | Already handles provider abstraction, rate limiting, JSON mode |
| Quiz session tracking | Custom tracking for synthesis | Existing `QuizSession` model | Sessions already track reviews via sessionId -- synthesis reviews flow through same path |
| Question shuffling | Custom randomization | `Array.sort(() => Math.random() - 0.5)` | Already used in existing theme quiz endpoint (review.ts line 662) |

**Key insight:** The synthesis feature is an extension of the existing quiz pipeline, not a parallel system. By adding `themeId` and `isSynthesis` to the `Quiz` model, synthesis questions automatically participate in the full quiz lifecycle (Card creation, Review submission, SM-2 scheduling, QuizSession tracking, memo generation). Zero duplication.

## Common Pitfalls

### Pitfall 1: contentId Cannot Be Made Nullable Without Migration Effort
**What goes wrong:** The existing `Quiz.contentId` is a required non-nullable FK. Making it nullable requires updating all code paths that assume `quiz.content` is always present (not null).
**Why it happens:** The backend and iOS both assume `quiz.content.title`, `quiz.content.id`, etc. are always available on quiz objects.
**How to avoid:** Audit all usages of `quiz.content` in both backend and iOS:
- `backend/src/services/quizGeneration.ts`: `processContentQuiz` always provides contentId -- safe.
- `backend/src/routes/review.ts`: Multiple endpoints join `quiz.content` -- must add null checks or use theme fallback for synthesis questions.
- `ios/hooks/useQuiz.ts`: `transformCardsToQuiz` reads `card.quiz.content.title` -- must handle null.
- `ios/app/quiz/theme/[id].tsx`: Doesn't directly access content fields -- safe.
**Warning signs:** TypeScript compilation errors about `content` possibly being null. Runtime crashes when accessing `quiz.content.title` on synthesis questions.

### Pitfall 2: Synthesis Questions Become Stale When Theme Content Changes
**What goes wrong:** User adds or removes content from a theme, but existing synthesis questions still reference old content combinations.
**Why it happens:** Synthesis questions are persisted with `themeId` and reference specific content combinations via `sourceContentIds` in the explanation.
**How to avoid:** When content is added/removed from a theme (in `POST /:id/content` and `DELETE /:id/content/:contentId`), delete existing synthesis quiz questions for that theme (or mark them for regeneration). This is analogous to how the theme memo cache is already cleared on content changes. Alternatively, track a `synthesisVersion` counter on the Theme model.
**Warning signs:** Synthesis questions reference content that is no longer in the theme, or miss relevant connections from newly added content.

### Pitfall 3: LLM Generates Questions Answerable from a Single Source
**What goes wrong:** Despite prompting for cross-content synthesis, the LLM generates questions that can be answered from a single content's memo.
**Why it happens:** LLMs tend toward the path of least resistance. If one memo is much richer than others, questions will cluster around it.
**How to avoid:** (1) The prompt must explicitly require `sourceIndices` with 2+ entries. (2) Post-process validation: filter out questions where `sourceIndices` has only 1 entry. (3) Include example synthesis questions in the prompt to calibrate the LLM's understanding of what "cross-content" means. (4) Cap individual memo length to prevent one memo from dominating.
**Warning signs:** Generated questions have `sourceIndices: [1]` instead of `[1, 3]`. Questions are factual recall about a single video rather than comparative or connective.

### Pitfall 4: Theme Quiz Session Exceeds 20-Question Cap
**What goes wrong:** The existing theme quiz caps at 20 questions. Adding synthesis questions could push the total beyond 20, or leave too few per-content questions.
**Why it happens:** Naive implementation appends synthesis questions to the per-content deck without adjusting limits.
**How to avoid:** Reserve a fixed proportion: e.g., up to 5 synthesis questions + up to 15 per-content questions = 20 total. If fewer synthesis questions are available, fill with more per-content questions. Sort per-content questions by SM-2 priority (most due first), then backfill with synthesis.
**Warning signs:** Quiz decks with 25+ questions, or quiz decks that are almost entirely synthesis questions with no per-content recall.

### Pitfall 5: Card Creation for Synthesis Questions Must Set userId
**What goes wrong:** When creating `Card` records for synthesis questions, the `userId` must be explicitly set since there's no `content.userId` to reference (contentId is null).
**Why it happens:** The existing `processContentQuiz` gets userId from `content.userId`. Synthesis questions don't have a content parent.
**How to avoid:** Pass `userId` explicitly to the synthesis question generation flow. The theme quiz endpoint already has `userId` from `req.user!.id`.
**Warning signs:** Cards created without userId, or 500 errors from Prisma constraint violations.

### Pitfall 6: Schema Migration Compatibility
**What goes wrong:** Making `contentId` nullable on Quiz and adding `themeId` FK requires a schema change on production.
**Why it happens:** This is an additive change (new nullable column + existing column made nullable), which is safe for `prisma db push`.
**How to avoid:** Deploy in order: (1) `prisma db push` to add the new columns, (2) `prisma generate` to update the client, (3) `npm run build` and restart. No data migration needed -- all existing Quiz rows keep their contentId values, and new nullable fields default to null.
**Warning signs:** TypeScript build errors about unknown fields. Runtime errors about missing columns.

## Code Examples

### Synthesis Question Generation Prompt (Detailed)

```typescript
// Source: Adapted from existing quiz generation in quizGeneration.ts
// Key differences: (1) input is multiple memos not one transcript,
// (2) explicit cross-content requirement, (3) sourceIndices tracking

const systemPrompt = `Tu es un concepteur pedagogique expert specialise dans les questions de SYNTHESE cross-contenu.

Tes questions suivent ces principes:
- Chaque question DOIT necessiter la comprehension d'AU MOINS 2 contenus differents
- Les questions mettent en relation, comparent, ou connectent des idees de sources distinctes
- Types de synthese: comparaison, cause-effet inter-sources, generalisation, contradiction, complementarite
- 4 options (A, B, C, D), une seule correcte
- Distracteurs plausibles qui pourraient etre vrais si on ne connait qu'UNE des sources
- Explication doit mentionner les sources par nom
- Tout en FRANCAIS

Reponds UNIQUEMENT en JSON valide.`;

const userPrompt = `Theme: "${themeName}"
Nombre de sources: ${contentMemos.length}

Sources:
${contentMemos.map((cm, i) => `[Source ${i + 1}: "${cm.title}"]
${cm.memo}`).join('\n\n---\n\n')}

Genere ${maxQuestions} questions de synthese qui REQUIERENT des connaissances d'au moins 2 sources differentes.

Format:
{
  "questions": [
    {
      "question": "Question claire necessitant 2+ sources ?",
      "options": ["A) Option", "B) Option", "C) Option", "D) Option"],
      "correctAnswer": "B",
      "explanation": "Explication mentionnant les sources par nom.",
      "sourceIndices": [1, 3],
      "synthesisType": "comparaison|cause-effet|generalisation|contradiction|complementarite"
    }
  ]
}`;
```

### Schema Change

```prisma
model Quiz {
  id          String   @id @default(cuid())
  contentId   String?                          // CHANGED: nullable for synthesis questions
  content     Content? @relation(fields: [contentId], references: [id], onDelete: Cascade)
  themeId     String?                          // NEW: set for synthesis questions
  theme       Theme?   @relation(fields: [themeId], references: [id], onDelete: Cascade)
  isSynthesis Boolean  @default(false)         // NEW: visual flag

  question    String
  type        QuizType
  options     Json
  correctAnswer String
  explanation String?

  createdAt   DateTime @default(now())
  cards       Card[]

  @@index([contentId])
  @@index([themeId])                           // NEW: efficient theme quiz queries
}

// Theme model addition:
model Theme {
  // ... existing fields ...
  quizzes     Quiz[]                           // NEW: relation for synthesis quizzes
}
```

### Extended Theme Quiz Endpoint

```typescript
// Source: Adapted from POST /practice/theme in review.ts (line 594-683)
// Key change: mix in synthesis cards alongside per-content cards

reviewRouter.post('/practice/theme', async (req, res, next) => {
  // ... existing validation and content query ...

  // Step 1: Get per-content cards (existing behavior)
  const contentCards = await prisma.card.findMany({
    where: {
      userId,
      quiz: { contentId: { in: contentIds }, isSynthesis: false },
    },
    include: {
      quiz: {
        include: {
          content: { select: { id: true, title: true, url: true, platform: true } },
        },
      },
    },
  });

  // Step 2: Get existing synthesis cards for this theme
  let synthesisCards = await prisma.card.findMany({
    where: {
      userId,
      quiz: { themeId, isSynthesis: true },
    },
    include: {
      quiz: {
        include: {
          theme: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Step 3: Generate synthesis questions if none exist and enough content memos available
  if (synthesisCards.length === 0) {
    const contentMemos = await collectContentMemosForTheme(themeId, userId);
    if (contentMemos.length >= 2) {
      const generated = await generateSynthesisQuestions(theme.name, contentMemos, 5);
      // Store in DB and create Cards
      for (const q of generated) {
        const quiz = await prisma.quiz.create({
          data: {
            themeId,
            contentId: null,
            isSynthesis: true,
            question: q.question,
            type: 'MULTIPLE_CHOICE',
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
          },
        });
        await prisma.card.create({
          data: { quizId: quiz.id, userId },
        });
      }
      // Re-fetch synthesis cards
      synthesisCards = await prisma.card.findMany({
        where: { userId, quiz: { themeId, isSynthesis: true } },
        include: { quiz: true },
      });
    }
  }

  // Step 4: Mix and cap at 20 (up to 5 synthesis + up to 15 content)
  const cappedSynthesis = synthesisCards.sort(() => Math.random() - 0.5).slice(0, 5);
  const remainingSlots = 20 - cappedSynthesis.length;
  const cappedContent = contentCards.sort(() => Math.random() - 0.5).slice(0, remainingSlots);
  const allCards = [...cappedContent, ...cappedSynthesis].sort(() => Math.random() - 0.5);

  return res.json({
    cards: allCards,
    count: allCards.length,
    theme: { id: theme.id, name: theme.name, emoji: theme.emoji },
    contentCount: contents.length,
    hasSynthesis: cappedSynthesis.length > 0,
    synthesisCount: cappedSynthesis.length,
  });
});
```

### iOS QuestionCard with Synthesis Badge

```typescript
// Source: Existing QuestionCard.tsx in components/quiz/
// Addition: isSynthesis prop and visual badge

interface QuestionCardProps {
  question: string;
  options: Option[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
  correctId?: string;
  isSynthesis?: boolean;  // NEW
}

// Inside render, before question text:
{props.isSynthesis && (
  <View style={{
    backgroundColor: '#6366F1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  }}>
    <Text variant="caption" color="inverse" weight="medium">
      Synthese
    </Text>
  </View>
)}
```

### Clearing Synthesis Questions on Theme Content Change

```typescript
// Source: Existing POST /:id/content and DELETE /:id/content/:contentId in themes.ts
// Addition: Delete synthesis quizzes for the theme when content changes

// After adding/removing content from theme:
await prisma.theme.update({
  where: { id: themeId },
  data: { memo: null, memoGeneratedAt: null },  // Already done (Phase 9)
});

// NEW: Also delete synthesis quizzes (they reference old content combinations)
const synthesisQuizIds = await prisma.quiz.findMany({
  where: { themeId, isSynthesis: true },
  select: { id: true },
});
if (synthesisQuizIds.length > 0) {
  // Cascade delete: Quiz -> Card -> Review
  await prisma.quiz.deleteMany({
    where: { themeId, isSynthesis: true },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Theme quiz = shuffled per-content questions only | Theme quiz = per-content + synthesis questions mixed | This phase | Users now test cross-content understanding, not just recall |
| Quiz.contentId is required | Quiz.contentId is nullable (with themeId for synthesis) | This phase | Quiz model supports both single-content and cross-content scopes |
| No cross-content question type | `isSynthesis` flag on Quiz model | This phase | Enables visual distinction and separate generation logic |

**Deprecated/outdated:**
- Nothing deprecated -- existing per-content quiz generation continues unchanged. Synthesis questions are additive.

## Open Questions

1. **Should synthesis questions be regenerated on each theme quiz session?**
   - What we know: Per-content quizzes are generated once and persisted forever. SM-2 scheduling relies on card persistence.
   - What's unclear: Whether synthesis questions should be treated as permanent (like content quizzes) or regenerated periodically.
   - Recommendation: Persist synthesis questions permanently. Delete and regenerate only when theme content changes (add/remove content). This enables SM-2 spaced repetition on synthesis questions, which is valuable for long-term retention of cross-content connections.

2. **How many synthesis questions per theme?**
   - What we know: Theme quiz is capped at 20 questions total. Prior decision says max 20 questions.
   - What's unclear: Optimal ratio of synthesis to per-content questions.
   - Recommendation: Generate up to 5 synthesis questions per theme. In each quiz session, include up to 5 synthesis questions + up to 15 per-content questions. If a theme has fewer than 2 content items with memos, skip synthesis questions entirely.

3. **Should the `sourceContentIds` be stored on the Quiz model?**
   - What we know: The LLM generates `sourceIndices` mapping questions to content items. This metadata could be stored for transparency.
   - What's unclear: Whether to store this as a JSON field on Quiz or just include it in the explanation text.
   - Recommendation: Include source content titles in the `explanation` field (already a string). Do NOT add a separate `sourceContentIds` JSON column -- it adds schema complexity with minimal user-facing value. The explanation already serves as the transparency mechanism.

4. **Should synthesis question generation happen on-demand or be triggered explicitly?**
   - What we know: Per-content quiz generation happens in a background worker. Theme memos are generated on-demand.
   - What's unclear: Whether synthesis questions should be generated when the user starts a theme quiz or pre-generated.
   - Recommendation: Generate on-demand when user starts theme quiz AND no synthesis questions exist yet for that theme. This avoids unnecessary LLM calls for themes the user never quizzes, and ensures freshness. The first theme quiz for a given theme will be slightly slower (1-2s for LLM call) but subsequent sessions use cached questions.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `backend/prisma/schema.prisma` -- Quiz, Card, Review, Theme, Content, ContentTheme models. Quiz has required `contentId` FK. Theme has `memo` and `memoGeneratedAt` fields from Phase 9.
- Codebase analysis: `backend/src/services/quizGeneration.ts` -- `generateQuizFromTranscript()` (lines 60-212), `generateMemoFromTranscript()` (lines 217-254), `processContentQuiz()` (lines 259-391). Shows LLM prompt structure, JSON mode, Bloom's taxonomy, French language, and quiz-to-card creation pipeline.
- Codebase analysis: `backend/src/services/llm.ts` -- `LLMClient` class with Mistral/OpenAI/Anthropic support, `generateText()` convenience function, `chatCompletion()` with jsonMode option. Uses `mistral-medium-latest` model.
- Codebase analysis: `backend/src/routes/review.ts` -- `POST /practice/theme` (lines 594-683) shows existing theme quiz flow: verify theme ownership, find READY content with quizzes, get all cards, shuffle, cap at 20.
- Codebase analysis: `backend/src/routes/themes.ts` -- `GET /:id/memo` (lines 412-512) shows how content memos are collected via ContentTheme join table, cap at 15, and synthesized via LLM. Cache cleared on content add/remove.
- Codebase analysis: `ios/hooks/useQuiz.ts` -- `useThemeQuiz()` (lines 132-143) shows how theme quiz data flows to iOS. `transformCardsToQuiz()` maps backend cards to frontend Question type.
- Codebase analysis: `ios/app/quiz/theme/[id].tsx` -- Theme quiz screen with question/feedback/summary states, session creation, answer submission.
- Codebase analysis: `ios/components/quiz/QuestionCard.tsx` -- Current QuestionCard props: question, options, selectedId, onSelect, disabled, correctId. No synthesis concept yet.
- Codebase analysis: `ios/types/content.ts` -- `Question` interface: id, question, options, correctAnswer, explanation. No synthesis flag.
- Codebase analysis: `backend/src/utils/rateLimiter.ts` -- `llmLimiter` at 5 concurrent calls.

### Secondary (MEDIUM confidence)
- Phase 9 research: `.planning/phases/09-theme-memo/09-RESEARCH.md` -- Confirmed theme memo architecture, content memo collection pattern, LLM synthesis prompt structure, and cache invalidation strategy.
- Mistral API: `mistral-medium-latest` model with 32K token context window (confirmed by existing usage patterns limiting input to 8000-12000 chars).

### Tertiary (LOW confidence)
- None -- all findings are from direct codebase analysis.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Zero new dependencies, all libraries already in use
- Architecture (Quiz model extension): HIGH -- Additive nullable fields, well-established pattern from Phase 9
- Architecture (synthesis prompt engineering): MEDIUM -- Prompt quality depends on tuning; the pattern is sound but output quality needs validation
- Pitfalls: HIGH -- Identified from existing codebase patterns and known FK constraints
- iOS integration: HIGH -- Direct extension of existing QuestionCard and theme quiz screen

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (stable -- no external dependencies changing)
