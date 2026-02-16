# Phase 17: SRS & Quiz Backend - Research

**Researched:** 2026-02-16
**Domain:** Spaced Repetition Scheduling (SM-2 variant) + LLM Quiz Prompt Engineering
**Confidence:** HIGH

## Summary

Phase 17 requires two independent backend changes: (1) aligning the SRS scheduling engine to fixed J+1/J+3/J+7/J+31 intervals instead of the current SM-2 floating-point intervals, and (2) reversing the quiz generation prompt from explicitly forbidding creator references to requiring self-referential framing with creator name, platform context, and temporal context.

Both changes are entirely backend-only. The SRS change touches the Prisma schema (`Card.nextReviewAt` default), the card creation code in `quizGeneration.ts` (3 call sites), the review submission handler in `review.ts` (SM-2 algorithm), and the `/due` endpoint query. The quiz prompt change touches `quizGeneration.ts` (system prompt, question prompt, and `generateQuizFromTranscript` function signature) plus the `processContentQuiz` caller which must pass additional content metadata (channelName, platform, capturedAt).

**Primary recommendation:** Implement as two independent plans. Plan 17-01 handles SRS interval alignment (schema + card creation + review logic + due query). Plan 17-02 handles quiz prompt rewrite (signature change + prompt reversal + platform/creator injection). Both plans are safe to execute independently and can be deployed together.

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | ^6.2.1 | ORM for Card/Quiz models | Already used throughout, schema changes via `prisma db push` |
| Express | ^4.21.2 | API routes for review submission | Already used, review.ts handles SM-2 |
| Mistral AI | via HTTP | LLM for quiz generation | Already configured as `mistral-medium-latest` |
| Zod | (bundled) | Request validation | Already used in review routes |

### Supporting (no new dependencies needed)
This phase requires **zero new npm packages**. All changes are logic-level modifications to existing code.

## Architecture Patterns

### Recommended Project Structure
No new files needed. All changes are modifications to existing files:
```
backend/
  prisma/
    schema.prisma          # Card.nextReviewAt default change
  src/
    services/
      quizGeneration.ts    # Prompt rewrite + signature change + card creation nextReviewAt
    routes/
      review.ts            # SM-2 interval logic change + due query adjustment
```

### Pattern 1: Fixed Interval Progression (SRS-01, SRS-02, SRS-03)
**What:** Replace the current SM-2 floating-point interval calculation with a fixed interval map keyed by repetition count.
**When to use:** When the product explicitly specifies research-backed intervals (J+1, J+3, J+7, J+31) rather than SM-2's dynamic intervals.
**Current code (review.ts lines 419-452):**
```typescript
// CURRENT: SM-2 dynamic intervals
if (ratingValue < 3) {
  newRepetitions = 0;
  newInterval = 1;
} else {
  newRepetitions += 1;
  if (newRepetitions === 1) {
    newInterval = 1;
  } else if (newRepetitions === 2) {
    newInterval = 3;
  } else {
    newInterval = Math.round(card.interval * newEaseFactor); // <-- dynamic
  }
  // ease factor adjustment...
  if (data.rating === 'EASY') {
    newInterval = Math.round(newInterval * 1.3);
  }
}
```
**Proposed replacement:**
```typescript
// FIXED interval map: repetition count -> interval in days
const INTERVAL_MAP: Record<number, number> = {
  1: 1,   // J+1 (first review)
  2: 3,   // J+3
  3: 7,   // J+7
  4: 31,  // J+31
};
const MAX_MAPPED_REP = 4;

if (ratingValue < 3) {
  // SRS-03: Failed review resets to J+1
  newRepetitions = 0;
  newInterval = 1;
} else {
  newRepetitions += 1;
  if (newRepetitions <= MAX_MAPPED_REP) {
    newInterval = INTERVAL_MAP[newRepetitions];
  } else {
    // Beyond J+31: use SM-2 dynamic intervals with easeFactor
    newInterval = Math.round(card.interval * newEaseFactor);
  }
  // SRS-04: Ease factor still adjusts (SM-2 compatible)
  newEaseFactor = Math.max(
    1.3,
    card.easeFactor + (0.1 - (5 - ratingValue) * (0.08 + (5 - ratingValue) * 0.02))
  );
}
```
**Key insight:** The first 4 intervals are fixed per PRD. After rep 4 (J+31), the system falls back to SM-2 dynamic intervals using easeFactor. This preserves SM-2 compatibility (SRS-04) while enforcing the research-backed progression for early reviews.

### Pattern 2: Card Creation with J+1 Delay (SRS-01)
**What:** When creating cards after quiz generation, set `nextReviewAt` to 24 hours from now instead of the Prisma default `now()`.
**Where:** 3 call sites in the codebase that create cards.
**Example:**
```typescript
// CURRENT (quizGeneration.ts line 505):
await tx.card.create({
  data: {
    quizId: quiz.id,
    userId: content.userId,
    // Default SM-2 values already set in schema <-- nextReviewAt = now()
  },
});

// PROPOSED:
const nextReviewAt = new Date();
nextReviewAt.setDate(nextReviewAt.getDate() + 1); // J+1: first review in 24h
await tx.card.create({
  data: {
    quizId: quiz.id,
    userId: content.userId,
    nextReviewAt,
  },
});
```
**Also change Prisma schema default** to be consistent:
```prisma
// CURRENT:
nextReviewAt DateTime @default(now())
// PROPOSED (removed default OR kept as now() for backward compat):
// Option A: Remove default, always pass explicitly
nextReviewAt DateTime
// Option B: Keep default but always override in code
nextReviewAt DateTime @default(now()) // but code always passes J+1
```
**Recommendation:** Option B (keep `@default(now())` in schema for backward compatibility, but always pass explicit `nextReviewAt` in code). This avoids a migration that could affect existing cards.

### Pattern 3: Self-Referential Quiz Prompts (QUIZ-01, QUIZ-02, QUIZ-03)
**What:** Reverse the current prompt rule that forbids creator/platform references, and instead require them.
**Current system prompt (quizGeneration.ts lines 213-223):**
```
REGLE ABSOLUE: Ne fais JAMAIS reference a l'auteur, au createur, a la video, au podcast, ou a la transcription dans tes questions.
```
**Current question prompt (lines 164-168):**
```
- INTERDIT: "Que dit l'auteur...", "Selon la video...", "Que mentionne le createur...", "D'apres le podcast..."
- INTERDIT: Toute reference a la transcription, au format (video/podcast), ou a l'auteur/createur
```
**Proposed replacement system prompt:**
```
REGLE DE CONTEXTUALISATION: Chaque question DOIT mentionner le createur et la plateforme source.
Utilise des formulations comme:
- "Dans cette video YouTube de [createur], quel concept est explique..."
- "Selon [createur] dans son podcast Spotify, pourquoi..."
- "D'apres la video TikTok de @[username], quelle technique..."
- "Dans ce reel Instagram de @[username], qu'est-ce qui..."

EFFET AUTO-REFERENTIEL: Contextualize temporellement quand possible:
- "Quand tu as regarde la video de [createur]..."
- "Dans le podcast que tu as ecoute de [createur]..."
```
**Function signature change needed:**
```typescript
// CURRENT:
export async function generateQuizFromTranscript(
  transcript: string,
  contentTitle: string,
  contentType: 'video' | 'podcast',
  existingQuestions: string[] = []
): Promise<QuizGenerationResult>

// PROPOSED:
export async function generateQuizFromTranscript(
  transcript: string,
  contentTitle: string,
  contentType: 'video' | 'podcast' | 'tiktok' | 'reel',
  contentMetadata: {
    creatorName?: string;      // channelName or authorUsername
    platformLabel: string;      // "YouTube", "Spotify", "TikTok", "Instagram"
    capturedAt?: Date;          // when user liked/saved it
  },
  existingQuestions: string[] = []
): Promise<QuizGenerationResult>
```

### Anti-Patterns to Avoid
- **Removing the EASY bonus entirely:** The PRD says fixed intervals for the first 4 reps, but doesn't address the EASY bonus. Keep the EASY bonus only for reps beyond J+31 (rep > 4). For the fixed interval reps (1-4), skip the EASY bonus since intervals are predetermined.
- **Changing existing card data in the database:** Do NOT retroactively update `nextReviewAt` on existing cards. Only new cards created after this change should use J+1. Existing cards should continue with their current schedule.
- **Making Prisma schema changes that require migration:** Prefer `prisma db push` over `prisma migrate dev` for the production Supabase database. The project does not use migration files in production.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interval calculation | Custom exponential backoff | Fixed interval map + SM-2 fallback | PRD specifies exact intervals, SM-2 dynamic is only needed post-J+31 |
| Platform label mapping | Inline if/else per platform | Constant map `Platform -> label` | Reduces duplication, easier to extend for new platforms |
| Creator name resolution | Complex conditional logic | `content.channelName \|\| content.authorUsername \|\| content.showName` | Content model already stores this per-platform |

**Key insight:** This phase is about modifying existing logic, not building new infrastructure. The risk is in subtle regressions, not in architectural complexity.

## Common Pitfalls

### Pitfall 1: TikTok/Instagram contentType Bug
**What goes wrong:** The current code maps ALL non-YouTube platforms to 'podcast' type:
```typescript
const contentType = content.platform === 'YOUTUBE' ? 'video' : 'podcast';
```
TikTok and Instagram content are videos, not podcasts. This causes the LLM prompt to say "podcast" for TikTok/Instagram content.
**Why it happens:** The original code predates TikTok/Instagram support.
**How to avoid:** Expand the contentType mapping:
```typescript
const contentType =
  content.platform === 'YOUTUBE' ? 'video' :
  content.platform === 'TIKTOK' ? 'tiktok' :
  content.platform === 'INSTAGRAM' ? 'reel' :
  'podcast'; // SPOTIFY
```
**Warning signs:** Quiz questions referencing "ce podcast" for a TikTok video.

### Pitfall 2: nextReviewAt Default Race Condition
**What goes wrong:** Changing the Prisma schema default from `@default(now())` to a computed value is not possible in Prisma (no `@default(now() + interval '1 day')`). If you remove the default entirely, any code path that creates a card without explicitly setting `nextReviewAt` will fail.
**Why it happens:** Prisma defaults are evaluated server-side (PostgreSQL), not client-side.
**How to avoid:** Keep the `@default(now())` in the schema but always override it in code. Search for ALL `card.create` call sites (there are 3) and ensure each passes explicit `nextReviewAt`.
**Warning signs:** Cards appearing immediately in the due queue after quiz generation.

### Pitfall 3: Breaking the /due Endpoint Behavior
**What goes wrong:** The `/due` endpoint currently shows cards where `nextReviewAt <= now()`. If new cards are created with `nextReviewAt = now() + 24h`, they won't appear in the "new cards" section until 24h later. This is the DESIRED behavior (SRS-01), but could confuse users who triage content and expect to see quizzes immediately.
**Why it happens:** The current UX shows new cards immediately (nextReviewAt = now()).
**How to avoid:** This is intentional per requirements. Phase 19 (Daily Digest) will be the primary mechanism for surfacing cards at the right time. Ensure the `/due` endpoint's stats reflect the correct counts.
**Warning signs:** Users reporting "I triaged content but no quiz appeared." This is expected; the first quiz is J+1.

### Pitfall 4: Quiz Prompt Regression (Bloom Taxonomy)
**What goes wrong:** When rewriting the prompt to include creator/platform context, the quality pedagogical rules (Bloom taxonomy, distractor quality, anti-repetition) get accidentally removed or weakened.
**Why it happens:** The prompt is ~40 lines of carefully tuned instructions. Modifying one section can inadvertently change the LLM's interpretation of other sections.
**How to avoid:** Make the creator/platform contextual framing an ADDITION to the existing prompt, not a replacement. Specifically: keep all the Bloom taxonomy, distractor quality, and anti-repetition rules. Only modify the "FORMULATION DES QUESTIONS" section to reverse the INTERDIT rules.
**Warning signs:** Quiz quality regression (obvious distractors, trivial questions, repeated angles).

### Pitfall 5: Empty Creator Name Handling
**What goes wrong:** Some content may have `channelName = null` (especially older content or failed metadata fetches). The prompt would then say "cette video YouTube de null" or "cette video YouTube de ".
**Why it happens:** Not all sync pipelines reliably populate `channelName`.
**How to avoid:** Add a fallback: if creatorName is null/empty, omit the creator reference and use only platform context ("cette video YouTube" without "de [creator]"). The prompt should handle both cases gracefully.
**Warning signs:** Questions containing "null" or dangling "de " in the text.

## Code Examples

### Example 1: All Card Creation Call Sites (3 total)

**Call site 1:** `quizGeneration.ts` line 505 (processContentQuiz - main flow)
```typescript
await tx.card.create({
  data: {
    quizId: quiz.id,
    userId: content.userId,
    // MUST add: nextReviewAt = now + 24h
  },
});
```

**Call site 2:** `quizGeneration.ts` line 662 (regenerateQuiz)
```typescript
await tx.card.create({
  data: { quizId: quiz.id, userId: content.userId },
  // MUST add: nextReviewAt = now + 24h
});
```

**Call site 3:** `review.ts` line 779-780 (synthesis card creation in /practice/theme)
```typescript
await prisma.card.create({
  data: { quizId: quiz.id, userId },
  // MUST add: nextReviewAt = now + 24h
});
```

### Example 2: Platform-Aware Content Type Resolution
```typescript
function getContentTypeLabel(platform: Platform): { type: string; label: string } {
  switch (platform) {
    case 'YOUTUBE':    return { type: 'video', label: 'YouTube' };
    case 'SPOTIFY':    return { type: 'podcast', label: 'Spotify' };
    case 'TIKTOK':     return { type: 'tiktok', label: 'TikTok' };
    case 'INSTAGRAM':  return { type: 'reel', label: 'Instagram' };
  }
}

function getCreatorName(content: {
  channelName?: string | null;
  authorUsername?: string | null;
  showName?: string | null;
  platform: string;
}): string | null {
  return content.channelName || content.authorUsername || content.showName || null;
}
```

### Example 3: Fixed Interval Map
```typescript
// Research-backed intervals per v4.0 PRD
const FIXED_INTERVALS: Record<number, number> = {
  1: 1,   // J+1: first review
  2: 3,   // J+3: second review
  3: 7,   // J+7: third review
  4: 31,  // J+31: fourth review
};
```

### Example 4: Self-Referential Prompt Fragment
```typescript
// Build creator context string for prompt injection
function buildCreatorContext(
  platformLabel: string,
  creatorName: string | null,
  capturedAt?: Date
): string {
  const platformRef = platformLabel === 'TikTok' || platformLabel === 'Instagram'
    ? `${platformLabel === 'TikTok' ? 'TikTok' : 'reel Instagram'}`
    : `${platformLabel === 'YouTube' ? 'video YouTube' : 'podcast Spotify'}`;

  const creatorRef = creatorName
    ? ` de ${creatorName}`
    : '';

  const temporalRef = capturedAt
    ? ` (contenu que tu as ${platformLabel === 'Spotify' ? 'ecoute' : 'regarde'} le ${capturedAt.toLocaleDateString('fr-FR')})`
    : '';

  return `cette ${platformRef}${creatorRef}${temporalRef}`;
}
// Example output: "cette video YouTube de Veritasium (contenu que tu as regarde le 14/02/2026)"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SM-2 dynamic intervals from rep 1 | Fixed intervals J+1/J+3/J+7/J+31 then SM-2 | v4.0 (this phase) | Predictable review cadence, research-backed |
| Quiz questions forbid creator refs | Quiz questions require creator + platform context | v4.0 (this phase) | Self-reference effect improves retention |
| `nextReviewAt = now()` on card creation | `nextReviewAt = now() + 24h` on card creation | v4.0 (this phase) | First review delayed to J+1 per SRS research |

**Context from SRS research:**
- The J+1/J+3/J+7/J+31 progression is a simplified version of the SuperMemo SM-2 algorithm's early intervals, but with fixed values rather than dynamic calculation. This is a common simplification used by Anki's default deck settings (1d, 3d, 7d graduating interval).
- The self-reference effect (Rogers et al., 1977) demonstrates that information encoded with self-relevant context is better retained. Adding "you watched this from [creator]" leverages both the self-reference effect and the context-dependent memory effect.

## Open Questions

1. **EASY bonus for fixed intervals**
   - What we know: Current code gives a 1.3x bonus for EASY rating. The PRD specifies fixed intervals J+1/J+3/J+7/J+31.
   - What's unclear: Should EASY skip a level (e.g., go from J+1 directly to J+7) or just proceed normally through the fixed progression?
   - Recommendation: **No EASY bonus for fixed intervals (reps 1-4).** The fixed progression is the intended path. EASY bonus only applies after rep 4 when SM-2 dynamic intervals resume. This is simpler and matches the "fixed progression" spirit.

2. **Existing cards in production**
   - What we know: There are existing cards with `nextReviewAt` set to past dates (already due or already reviewed).
   - What's unclear: Should we backfill existing cards to align with new intervals?
   - Recommendation: **No backfill.** Existing cards keep their current schedule. Only new cards created after deployment use J+1 delay. This avoids disrupting active users' review schedules.

3. **regenerateQuiz and nextReviewAt**
   - What we know: `regenerateQuiz()` deletes existing quizzes/cards and creates new ones.
   - What's unclear: Should regenerated cards also get J+1 delay, or should they be immediately available since the user explicitly requested regeneration?
   - Recommendation: **J+1 delay for regenerated cards too.** The regeneration creates entirely new questions the user hasn't seen. They should follow the same SRS schedule as fresh cards.

## Codebase Findings Summary

### Files to Modify

| File | What Changes | Requirements |
|------|-------------|-------------|
| `backend/prisma/schema.prisma` | Consider keeping `@default(now())` but documenting that code always overrides it | SRS-01 |
| `backend/src/services/quizGeneration.ts` | (1) `generateQuizFromTranscript` signature + prompt rewrite (2) `processContentQuiz` passes metadata (3) `regenerateQuiz` passes metadata (4) All 2 card.create calls get explicit nextReviewAt | SRS-01, QUIZ-01, QUIZ-02, QUIZ-03 |
| `backend/src/routes/review.ts` | (1) SM-2 interval logic replaced with fixed map + SM-2 fallback (2) EASY bonus restricted to rep > 4 (3) 1 card.create call gets explicit nextReviewAt | SRS-02, SRS-03, SRS-04 |

### Data Available for Quiz Context

The `Content` model already stores everything needed for self-referential prompts:

| Field | Content | Available for |
|-------|---------|---------------|
| `platform` | YOUTUBE, SPOTIFY, TIKTOK, INSTAGRAM | Platform label in prompt |
| `channelName` | YouTube channel / Spotify show / TikTok author / Instagram author | Creator name |
| `authorUsername` | TikTok @username / Instagram @username | Fallback creator name |
| `showName` | Spotify show name | Podcast show name |
| `capturedAt` | When user liked/saved the content | Temporal context |

All these fields are already populated by the sync workers. The `processContentQuiz` function already fetches the full `Content` object, so no additional DB query is needed.

### Card Creation Sites Inventory

| Location | File:Line | Context | Needs nextReviewAt |
|----------|-----------|---------|-------------------|
| `processContentQuiz` | `quizGeneration.ts:505` | Main quiz generation flow | YES |
| `regenerateQuiz` | `quizGeneration.ts:662` | User-requested quiz regeneration | YES |
| `practice/theme` handler | `review.ts:779` | Background synthesis card creation | YES |

## Sources

### Primary (HIGH confidence)
- `backend/prisma/schema.prisma` -- Card model definition, `nextReviewAt @default(now())`, SM-2 fields
- `backend/src/services/quizGeneration.ts` -- Full quiz generation pipeline, LLM prompt, card creation
- `backend/src/routes/review.ts` -- SM-2 algorithm implementation (lines 419-452), /due endpoint, card creation
- `backend/src/routes/content.ts` -- Triage flow that triggers quiz generation
- `.planning/REQUIREMENTS.md` -- SRS-01 through SRS-04, QUIZ-01 through QUIZ-03 definitions
- `.planning/STATE.md` -- Prior decisions: "Current quiz prompt explicitly FORBIDS creator references"
- `.planning/ROADMAP.md` -- Phase 17 success criteria and plan structure

### Secondary (MEDIUM confidence)
- SM-2 algorithm (SuperMemo): The current implementation follows standard SM-2 with modifications. The fixed interval map (J+1/J+3/J+7/J+31) is a well-established simplification used by Anki and similar SRS tools.
- Self-reference effect (Rogers, Kuiper & Kirker, 1977): Encoding information in relation to the self improves recall. This is the theoretical basis for QUIZ-01/02/03.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all modifications to existing code
- Architecture: HIGH - All patterns directly derived from reading the existing codebase
- Pitfalls: HIGH - Identified from actual code analysis (3 card.create sites, TikTok/Instagram bug, null creator handling)

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- no external dependency changes expected)
