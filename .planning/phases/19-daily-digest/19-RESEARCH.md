# Phase 19: Daily Digest - Research

**Researched:** 2026-02-16
**Domain:** Daily learning session (card selection algorithm + quiz session UI with cognitive closure)
**Confidence:** HIGH

## Summary

Phase 19 creates a "Daily Digest" -- a single daily learning session of 10-15 questions that mixes SRS due cards and new content cards, launched from a prominent button on the home screen. The session includes a progress indicator ("Question 5/12") and ends with a cognitive closure screen showing score percentage, answer streak, and session duration.

The infrastructure for this feature is already largely built. The backend has a `/reviews/due` endpoint that already separates due cards (repetitions > 0, nextReviewAt <= now) from new cards (repetitions = 0, nextReviewAt <= now), respects a `newCardsPerDay` limit, and returns combined results. The frontend has a complete quiz session flow (`QuestionCard`, `AnswerFeedback`, `QuizSummary`) with session creation, answer submission (with SM-2 scheduling), and session completion tracking. The key work is: (1) a new backend endpoint that curates exactly 10-15 cards with the right priority mix, (2) a new "Daily Digest" screen with a progress bar and enhanced cognitive closure, and (3) integrating a launch point into the home screen.

**Primary recommendation:** Implement as two plans. Plan 19-01 creates a dedicated `POST /api/reviews/digest` backend endpoint that encapsulates the card selection algorithm (SRS due priority + new card fill to reach 10-15 cap). Plan 19-02 creates the digest session UI: a new `ios/app/digest.tsx` screen with progress indicator, answer flow (reusing `QuestionCard` and `AnswerFeedback`), and an enhanced `DigestClosure` component showing score percentage, best answer streak, and session duration. The home screen gets a prominent "Daily Digest" CTA button.

## Standard Stack

### Core (already in project - no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | ^6.2.1 | Card/Quiz queries for digest selection | Already used, `/due` endpoint has the query patterns |
| Express + Zod | ^4.21.2 | New `/reviews/digest` endpoint with validation | Already used for all review routes |
| @tanstack/react-query | ^5.90.20 | `useDigestSession` hook for fetching + mutations | Already powers all data hooks |
| react-native-reanimated | ~4.1.1 | Progress bar animation, closure screen entrance | Already used throughout |
| expo-haptics | ~15.0.8 | Haptic feedback on correct/incorrect, session complete | Already used via `haptics` utility |
| expo-router | ~5.0.7 | New `/digest` route for session screen | Already used for all navigation |
| lucide-react-native | ^0.563.0 | Icons for closure screen (Trophy, Flame, Clock) | Already used for all icons |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | ^5.0.11 | Optional: digest session state if needed across screens | Already installed, but local state may suffice |
| expo-blur | ~15.0.8 | Glass card for digest CTA on home screen | Already used in GlassCard component |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `/reviews/digest` endpoint | Reuse existing `/reviews/due` with query params | Cleaner separation of concerns; digest has specific business logic (10-15 cap, mixing algorithm) that would clutter the generic `/due` endpoint |
| New `ios/app/digest.tsx` screen | Extend existing `ios/app/quiz/[id].tsx` with a "digest" mode | Existing quiz screen is content-scoped; digest is cross-content. Separate screen avoids conditional spaghetti |
| Local React state for session | Zustand store for digest state | Session state (currentIndex, score, streak, startTime) is screen-local. No need for global store. |

### Installation
No additional packages needed. Zero new npm dependencies.

## Architecture Patterns

### Recommended Project Structure

**Backend (1 new file, 1 modified file):**
```
backend/src/
  routes/
    review.ts          # ADD: digestRouter mounted at /api/reviews/digest
                       # OR: Add digest endpoint inline in reviewRouter
```

**iOS (2 new files, 2-3 modified files):**
```
ios/
  app/
    digest.tsx                    # NEW: Digest session screen (question flow + closure)
  components/
    digest/
      DigestClosure.tsx           # NEW: Cognitive closure screen (score, streak, duration)
      ProgressBar.tsx             # NEW: Animated progress indicator bar
    home/
      DigestCTA.tsx               # NEW: Prominent launch button for home screen
  hooks/
    useDigest.ts                  # NEW: useDigestCards hook + session management
    index.ts                      # MODIFY: export new hooks
  app/
    (tabs)/index.tsx              # MODIFY: add DigestCTA to home screen
    _layout.tsx                   # MODIFY: add Stack.Screen for digest route
```

### Pattern 1: Card Selection Algorithm (DIGEST-02, DIGEST-05)
**What:** Backend endpoint that builds a 10-15 question digest by prioritizing SRS due cards over new cards.
**When to use:** Called once when user taps "Start Daily Digest" on home screen.
**Algorithm:**
```typescript
// Step 1: Get all SRS due cards (repetitions > 0, nextReviewAt <= now)
// Ordered by nextReviewAt ASC (most overdue first)
const dueCards = await prisma.card.findMany({
  where: {
    userId,
    repetitions: { gt: 0 },
    nextReviewAt: { lte: new Date() },
  },
  orderBy: { nextReviewAt: 'asc' },
  take: MAX_DIGEST_SIZE, // 15
  include: { quiz: { include: { content: { select: { id: true, title: true, platform: true, url: true } } } } },
});

// Step 2: Calculate remaining slots for new cards
const dueCount = dueCards.length;
const minTotal = MIN_DIGEST_SIZE; // 10
const maxTotal = MAX_DIGEST_SIZE; // 15
const newCardSlots = Math.max(0, maxTotal - dueCount);

// Step 3: Fill remaining slots with new cards (respecting daily limit)
// Only if we haven't hit the daily new card limit
const settings = await prisma.userSettings.findUnique({ where: { userId } });
const newCardsPerDay = settings?.newCardsPerDay ?? 20;
const firstReviewsToday = await prisma.review.count({
  where: { userId, createdAt: { gte: today }, card: { repetitions: 1 } },
});
const remainingNewToday = Math.max(0, newCardsPerDay - firstReviewsToday);
const newCardsToPull = Math.min(newCardSlots, remainingNewToday);

const newCards = await prisma.card.findMany({
  where: { userId, repetitions: 0, nextReviewAt: { lte: new Date() } },
  orderBy: { createdAt: 'asc' },
  take: newCardsToPull,
  include: { quiz: { include: { content: { select: { id: true, title: true, platform: true, url: true } } } } },
});

// Step 4: Combine and shuffle
const allCards = [...dueCards, ...newCards];
// Shuffle to avoid predictable ordering (due-then-new)
const shuffled = allCards.sort(() => Math.random() - 0.5);

// Step 5: If total < MIN_DIGEST_SIZE, return what we have (or empty/insufficient)
```
**Key insight:** The existing `/reviews/due` endpoint already has this exact query pattern (lines 183-278 in `review.ts`). The digest endpoint is a focused version with: (a) hard cap of 10-15, (b) shuffle, (c) session auto-creation, and (d) the `dueCount`/`newCount` stats in the response so the UI knows the mix.

### Pattern 2: Digest Session Screen Flow (DIGEST-01, DIGEST-03, DIGEST-04)
**What:** Full-screen quiz session with progress bar, question/feedback states, and cognitive closure.
**Flow:**
```
[Home Screen] --tap CTA--> [Digest Loading] --cards loaded--> [Question 1/12]
  |                                                               |
  |                                                         select answer
  |                                                               |
  |                                                         [Feedback]
  |                                                               |
  |                                                         tap "Next"
  |                                                               |
  |                                                     [Question 2/12]
  |                                                          ... repeat ...
  |                                                               |
  |                                                     [Question 12/12]
  |                                                               |
  |                                                         [Feedback]
  |                                                               |
  |                                                    tap "Voir le resultat"
  |                                                               |
  |                                                    [Cognitive Closure]
  |                                                     - Score: 10/12 (83%)
  |                                                     - Best streak: 5
  |                                                     - Duration: 3m 42s
  |                                                               |
  |<-------------- tap "Retour" or "Voir les erreurs" ------------|
```
**State machine (local React state):**
```typescript
type DigestState = 'loading' | 'question' | 'feedback' | 'closure';

// Local state
const [currentIndex, setCurrentIndex] = useState(0);
const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
const [score, setScore] = useState(0);
const [currentStreak, setCurrentStreak] = useState(0);
const [bestStreak, setBestStreak] = useState(0);
const [sessionStartTime] = useState(Date.now());
const [questionStartTime, setQuestionStartTime] = useState(Date.now());
const [sessionId, setSessionId] = useState<string | null>(null);
```

### Pattern 3: Cognitive Closure Screen (DIGEST-04)
**What:** Post-session screen showing performance summary to give the user a sense of completion.
**Research basis:** Cognitive closure (Kruglanski & Webster, 1996) -- providing clear session boundaries and performance feedback enhances the sense of learning accomplishment and habit formation.
**Stats to show:**
1. **Score percentage:** `Math.round((score / total) * 100)%` with a large circular/text indicator
2. **Best answer streak:** Longest consecutive correct answers in the session
3. **Session duration:** `Math.floor(elapsed / 60)m ${elapsed % 60}s` format
4. **Actions:** "Retour" (go home), optionally "Voir les erreurs" (navigate to session mistakes)

### Pattern 4: Home Screen Integration (DIGEST-01)
**What:** Prominent CTA button on the home screen above the recommendation cards.
**Design:** A full-width GlassCard with accent color that shows:
- Title: "Revision du jour" or "Daily Digest"
- Subtitle: "{N} questions a reviser" (from `/reviews/stats` dueToday count)
- Call-to-action: Large tap target that navigates to `/digest`
**Placement:** Between GreetingHeader and the recommendation cards list.
**Empty state:** If no cards are due (dueToday === 0 and no new cards), show a "Tout est a jour !" message or hide the CTA.

### Anti-Patterns to Avoid
- **Building a new session model:** The existing `QuizSession` model already supports everything needed: `startedAt`, `completedAt`, `correctCount`, `totalCount`, review tracking via `Review.sessionId`. Do NOT create a new `DigestSession` model.
- **Fetching all cards then filtering client-side:** The card selection algorithm MUST run on the backend. The client does not know other users' daily limits, and sending all cards wastes bandwidth. One API call returns the pre-built digest.
- **Complex navigation stack for digest:** Use a single `digest.tsx` screen that manages its own state machine internally (loading -> question -> feedback -> closure). No need for nested navigation.
- **Computing streak on backend:** The "best answer streak" within a single session is a UI concern. Track it in local state (increment on correct, reset on incorrect, track max). The backend `Streak` model tracks daily streak across sessions, which is different.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Card selection with priority | Custom SQL query from scratch | Adapt existing `/reviews/due` query patterns | Same WHERE clauses, just different LIMIT and shuffle |
| Quiz session tracking | New session model or tracking system | Existing `QuizSession` + `Review` models | Already tracks session completion, correct/total counts, review ratings |
| Question/answer UI | New quiz components | Existing `QuestionCard`, `AnswerFeedback` components | Already handle option display, selection, correct/incorrect feedback |
| Answer submission + SM-2 | New review submission logic | Existing `useSubmitAnswer` hook + `POST /reviews` | SM-2 algorithm already correct from Phase 17 |
| Session completion | New completion logic | Existing `useCompleteSession` hook + `POST /reviews/session/:id/complete` | Already computes stats from reviews |
| Progress indicator | Custom animated bar from scratch | `react-native-reanimated` `useAnimatedStyle` + `withTiming` | Simple width animation, no need for a library |

**Key insight:** Phase 19 is primarily an assembly phase -- most building blocks already exist. The card selection algorithm is the only truly new backend logic. The UI is a new screen that composes existing components with a progress bar and closure screen.

## Common Pitfalls

### Pitfall 1: Digest Returns Zero Cards
**What goes wrong:** User taps "Daily Digest" but the API returns 0 cards because: (a) all SRS cards are not yet due, (b) new cards haven't been created yet (content still processing), or (c) user hasn't triaged any content.
**Why it happens:** J+1 delay means new cards aren't immediately available. Users who just started may have no READY content.
**How to avoid:** The digest endpoint should return a clear `{ cards: [], reason: 'no_cards_due' }` response. The UI should show a friendly empty state: "Rien a reviser aujourd'hui -- revenez demain !" or redirect to triage if no content exists. The home screen CTA should show the due count and be dimmed/disabled when 0.
**Warning signs:** Users tapping the digest button and seeing a blank screen or error.

### Pitfall 2: Digest Session Not Tracked in QuizSession
**What goes wrong:** Digest answers are submitted but not linked to a session, so the session doesn't appear in the Reviews tab and can't generate a memo.
**Why it happens:** Forgetting to create a `QuizSession` before submitting answers, or not passing `sessionId` to the `POST /reviews` endpoint.
**How to avoid:** The digest flow MUST: (1) create a session via `POST /reviews/session` with `mode: 'due'` before the first question, (2) pass `sessionId` with every answer submission, (3) complete the session via `POST /reviews/session/:id/complete` after the last answer. This mirrors the existing flow in `quiz/[id].tsx`.
**Warning signs:** Digest sessions not appearing in the Reviews tab.

### Pitfall 3: Answer Streak Tracked Server-Side Instead of Client-Side
**What goes wrong:** Trying to compute "best consecutive correct answers" from the database, which requires ordering Reviews by creation time and finding the longest consecutive GOOD/EASY sequence.
**Why it happens:** Confusion between the daily Streak (cross-session, server-side) and the session answer streak (within one session, client-side).
**How to avoid:** The "best answer streak" stat on the cognitive closure screen is purely a client-side counter:
```typescript
if (isCorrect) {
  const newStreak = currentStreak + 1;
  setCurrentStreak(newStreak);
  if (newStreak > bestStreak) setBestStreak(newStreak);
} else {
  setCurrentStreak(0);
}
```
The server-side `Streak` model (daily streak) is updated automatically by the existing `updateStreak()` function called on each review submission.
**Warning signs:** Unnecessary database queries for streak calculation.

### Pitfall 4: Session Duration Timer Drift
**What goes wrong:** Using `setInterval` or `useEffect` to track elapsed time, causing re-renders every second during the quiz.
**Why it happens:** Wanting to show a live timer during the session.
**How to avoid:** Do NOT show a live timer during the session (it creates anxiety and hurts learning). Only compute duration at session end: `const durationMs = Date.now() - sessionStartTime`. Show formatted duration only on the closure screen. This is simpler and better UX.
**Warning signs:** Unnecessary re-renders, timer jank during question answering.

### Pitfall 5: Race Condition Between Session Create and First Answer
**What goes wrong:** User answers the first question before the session creation API call completes, causing the answer to be submitted without a sessionId.
**Why it happens:** Session creation is async, and the existing quiz screens handle this by disabling the "Valider" button until sessionId is set.
**How to avoid:** Follow the same pattern as `quiz/[id].tsx`: disable the validate button while `!sessionId`. The existing `useCreateSession` hook handles this. Additionally, the digest endpoint could return a pre-created session ID along with the cards (combining two API calls into one).
**Warning signs:** Reviews with `sessionId: null`.

### Pitfall 6: Duplicate Daily Digest Sessions
**What goes wrong:** User starts a digest, quits mid-session, starts another. Two incomplete sessions exist.
**Why it happens:** No guard against multiple in-progress digest sessions.
**How to avoid:** For v4.0, this is acceptable -- treat it like any other abandoned quiz session. The `QuizSession` will just remain without a `completedAt`. Future enhancement could check for incomplete digest sessions on launch and offer to resume. For now, KISS.
**Warning signs:** None for v4.0, but worth noting for future.

## Code Examples

### Example 1: Digest Endpoint (Backend)
```typescript
// POST /api/reviews/digest - Build and return a daily digest session
const MIN_DIGEST = 10;
const MAX_DIGEST = 15;

reviewRouter.post('/digest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Due cards (SRS priority)
    const dueCards = await prisma.card.findMany({
      where: {
        userId,
        repetitions: { gt: 0 },
        nextReviewAt: { lte: new Date() },
      },
      orderBy: { nextReviewAt: 'asc' },
      take: MAX_DIGEST,
      include: {
        quiz: {
          include: {
            content: {
              select: { id: true, title: true, url: true, platform: true },
            },
          },
        },
      },
    });

    // 2. New card budget
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    const newCardsPerDay = settings?.newCardsPerDay ?? 20;
    const firstReviewsToday = await prisma.review.count({
      where: { userId, createdAt: { gte: today }, card: { repetitions: 1 } },
    });
    const remainingNew = Math.max(0, newCardsPerDay - firstReviewsToday);
    const newSlots = Math.min(Math.max(0, MAX_DIGEST - dueCards.length), remainingNew);

    // 3. New cards
    const newCards = newSlots > 0 ? await prisma.card.findMany({
      where: { userId, repetitions: 0, nextReviewAt: { lte: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: newSlots,
      include: {
        quiz: {
          include: {
            content: {
              select: { id: true, title: true, url: true, platform: true },
            },
          },
        },
      },
    }) : [];

    // 4. Combine and shuffle
    const allCards = [...dueCards, ...newCards].sort(() => Math.random() - 0.5);

    if (allCards.length === 0) {
      return res.json({ cards: [], session: null, reason: 'no_cards_due' });
    }

    // 5. Auto-create session
    const session = await prisma.quizSession.create({
      data: {
        userId,
        questionLimit: allCards.length,
        mode: 'due',
      },
    });

    return res.json({
      cards: allCards,
      count: allCards.length,
      session: { id: session.id },
      stats: {
        dueCount: dueCards.length,
        newCount: newCards.length,
      },
    });
  } catch (error) {
    return next(error);
  }
});
```

### Example 2: Digest Hook (Frontend)
```typescript
// hooks/useDigest.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface DigestCard {
  id: string; // card.id
  quiz: {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    content: { id: string; title: string; platform: string } | null;
    isSynthesis?: boolean;
  };
}

interface DigestResponse {
  cards: DigestCard[];
  count: number;
  session: { id: string } | null;
  reason?: string;
  stats: { dueCount: number; newCount: number };
}

export function useDigestCards() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<DigestResponse>('/reviews/digest');
      return data;
    },
  });
}
```

### Example 3: Progress Bar Component
```typescript
// components/digest/ProgressBar.tsx
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, borderRadius } from '../../theme';

interface ProgressBarProps {
  current: number; // 0-indexed current question
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const progress = total > 0 ? (current + 1) / total : 0;

  const animatedStyle = useAnimatedStyle(() => ({
    width: withTiming(`${progress * 100}%`, { duration: 300 }),
  }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
  },
});
```

### Example 4: Cognitive Closure Screen
```typescript
// components/digest/DigestClosure.tsx
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy, Flame, Clock } from 'lucide-react-native';
import { Text, Button } from '../ui';
import { colors, spacing } from '../../theme';

interface DigestClosureProps {
  score: number;
  total: number;
  bestStreak: number;
  durationMs: number;
  onClose: () => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function DigestClosure({ score, total, bestStreak, durationMs, onClose }: DigestClosureProps) {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text variant="h1" style={styles.percentage}>{percentage}%</Text>
        <Text variant="body" color="secondary">
          {score}/{total} bonnes reponses
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Trophy size={24} color={colors.accent} />
            <Text variant="h3">{score}/{total}</Text>
            <Text variant="caption" color="secondary">Score</Text>
          </View>
          <View style={styles.stat}>
            <Flame size={24} color={colors.accent} />
            <Text variant="h3">{bestStreak}</Text>
            <Text variant="caption" color="secondary">Meilleure serie</Text>
          </View>
          <View style={styles.stat}>
            <Clock size={24} color={colors.accent} />
            <Text variant="h3">{formatDuration(durationMs)}</Text>
            <Text variant="caption" color="secondary">Duree</Text>
          </View>
        </View>

        <Button variant="primary" fullWidth onPress={onClose}>
          Retour
        </Button>
      </View>
    </SafeAreaView>
  );
}
```

### Example 5: Home Screen CTA Integration
```typescript
// In ios/app/(tabs)/index.tsx, between GreetingHeader and cardsList:
<DigestCTA
  dueCount={reviewStats?.dueToday ?? 0}
  onPress={() => router.push('/digest')}
/>

// components/home/DigestCTA.tsx
export function DigestCTA({ dueCount, onPress }: { dueCount: number; onPress: () => void }) {
  if (dueCount === 0) return null; // Hide when nothing due

  return (
    <GlassCard padding="lg" onPress={onPress} style={styles.cta}>
      <View style={styles.row}>
        <View>
          <Text variant="h3">Revision du jour</Text>
          <Text variant="body" color="secondary">
            {dueCount} question{dueCount > 1 ? 's' : ''} a reviser
          </Text>
        </View>
        <ChevronRight size={24} color={colors.textSecondary} />
      </View>
    </GlassCard>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic `/reviews/due` endpoint with high limit | Dedicated `/reviews/digest` with 10-15 cap and auto-session | Phase 19 (this phase) | Focused microlearning session instead of unbounded card queue |
| `QuizSummary` with score only | `DigestClosure` with score + streak + duration | Phase 19 (this phase) | Cognitive closure enhances habit formation |
| Home screen shows only recommendation cards | Home screen adds prominent Digest CTA | Phase 19 (this phase) | Primary learning entry point is one tap away |

**Context from learning science:**
- **Microlearning sessions (10-15 items):** Research on working memory load (Cowan, 2001) suggests that 10-15 items per session is optimal for retention without cognitive fatigue. Longer sessions show diminishing returns.
- **Cognitive closure effect:** Providing clear session boundaries with performance feedback (Kruglanski & Webster, 1996) enhances the sense of accomplishment and increases likelihood of returning for the next session.
- **Interleaving:** Mixing SRS due cards (review) with new cards (learning) in a single session leverages the interleaving effect, which improves long-term retention compared to blocked practice.

## Codebase Findings Summary

### Existing Infrastructure to Reuse

| Component | Location | How It's Used |
|-----------|----------|---------------|
| `/reviews/due` endpoint | `backend/src/routes/review.ts:183-294` | Query patterns for due cards + new cards (adapt for digest) |
| `QuizSession` model | `backend/prisma/schema.prisma:439-464` | Session tracking with `correctCount`, `totalCount`, `completedAt` |
| `POST /reviews` endpoint | `backend/src/routes/review.ts:394-511` | SM-2 answer submission with session linking |
| `POST /reviews/session/:id/complete` | `backend/src/routes/review.ts:1058-1109` | Session completion with stat computation |
| `useSubmitAnswer` hook | `ios/hooks/useQuiz.ts:188-203` | Answer submission mutation |
| `useCompleteSession` hook | `ios/hooks/useQuiz.ts:220-240` | Session completion mutation |
| `useCreateSession` hook | `ios/hooks/useQuiz.ts:162-178` | Session creation (may not need if digest auto-creates) |
| `QuestionCard` component | `ios/components/quiz/QuestionCard.tsx` | Full question + options UI |
| `AnswerFeedback` component | `ios/components/quiz/AnswerFeedback.tsx` | Correct/incorrect feedback UI |
| `haptics` utility | `ios/lib/haptics.ts` | Selection, success, error haptics |
| `GlassCard` component | `ios/components/glass/GlassCard.tsx` | Glass card for home CTA |
| `colors`, `spacing`, `fonts` | `ios/theme.ts` | Night Blue design tokens |
| `/reviews/stats` endpoint | `backend/src/routes/review.ts:297-382` | Due count for home CTA badge |
| `useReviewStats` hook | `ios/hooks/useReviews.ts:130-138` | Frontend access to due counts |

### Files to Create

| File | Purpose | Requirements |
|------|---------|-------------|
| `ios/app/digest.tsx` | Digest session screen (question flow + closure) | DIGEST-01, DIGEST-03, DIGEST-04 |
| `ios/components/digest/DigestClosure.tsx` | Cognitive closure component | DIGEST-04 |
| `ios/components/digest/ProgressBar.tsx` | Animated progress bar | DIGEST-03 |
| `ios/components/home/DigestCTA.tsx` | Home screen launch button | DIGEST-01 |
| `ios/hooks/useDigest.ts` | Digest data fetching hook | DIGEST-02, DIGEST-05 |

### Files to Modify

| File | What Changes | Requirements |
|------|-------------|-------------|
| `backend/src/routes/review.ts` | Add `POST /digest` endpoint with card selection algorithm | DIGEST-02, DIGEST-05 |
| `ios/app/(tabs)/index.tsx` | Add DigestCTA component + useReviewStats | DIGEST-01 |
| `ios/app/_layout.tsx` | Add Stack.Screen for `/digest` route | DIGEST-01 |
| `ios/hooks/index.ts` | Export new digest hooks | Supporting |

### Navigation Details

The new digest screen should be registered in `ios/app/_layout.tsx` as:
```typescript
<Stack.Screen
  name="digest"
  options={{
    headerShown: false,
    presentation: 'card',
    animation: 'fade',
    gestureEnabled: false, // Prevent accidental back swipe during quiz
  }}
/>
```

Setting `gestureEnabled: false` prevents the user from accidentally swiping back during a quiz, which would lose their progress. The screen provides explicit "Quitter" and "Retour" actions.

## Open Questions

1. **Minimum digest size behavior**
   - What we know: The target is 10-15 questions. If only 3 cards are due and 2 new cards are available (total 5), that's below the minimum.
   - What's unclear: Should we enforce a minimum of 10, or show whatever is available?
   - Recommendation: **Show whatever is available, even if below 10.** A digest of 5 questions is better than no digest. The 10-15 range is the ideal, not a hard minimum. Reserve the CTA hiding for the case of 0 cards.

2. **Digest CTA visibility when only new cards exist**
   - What we know: The home CTA should show due count. But "new cards" are also included in the digest.
   - What's unclear: Should the CTA show `dueToday` (which includes both review due and capped new cards) or just `reviewDue`?
   - Recommendation: **Show `dueToday` from the existing stats endpoint.** It already computes `reviewDue + min(newDue, remainingNewToday)`, which matches the digest total. This is already computed and ready.

3. **Digest endpoint as mutation vs query**
   - What we know: The digest creates a session (side effect) and returns cards. This is more like a mutation than a query.
   - What's unclear: Should the frontend use `useQuery` or `useMutation` for the initial fetch?
   - Recommendation: **Use `useMutation` triggered on screen mount.** The endpoint creates a QuizSession as a side effect. Using a mutation prevents accidental re-fetches (React Query's staleTime refetch, focus refetch, etc.) which would create duplicate sessions. Trigger once on mount via `useEffect`.

## Sources

### Primary (HIGH confidence)
- `backend/src/routes/review.ts` -- Complete review/session/due infrastructure (1604 lines reviewed)
- `backend/prisma/schema.prisma` -- Card, Quiz, QuizSession, Review, Streak models
- `ios/app/quiz/[id].tsx` -- Existing quiz session flow (question/feedback/summary state machine)
- `ios/app/quiz/theme/[id].tsx` -- Theme quiz session flow (identical pattern)
- `ios/hooks/useQuiz.ts` -- Quiz hooks (useQuiz, useSubmitAnswer, useCreateSession, useCompleteSession)
- `ios/hooks/useReviews.ts` -- Review hooks (useReviewStats, useCompletedSessions)
- `ios/components/quiz/` -- QuestionCard, AnswerFeedback, QuizSummary components
- `ios/app/(tabs)/index.tsx` -- Current home screen layout (GreetingHeader + recommendation cards)
- `ios/app/_layout.tsx` -- Root layout with Stack navigation and screen registration
- `ios/theme.ts` -- Design tokens (Night Blue palette, spacing, fonts)
- `.planning/REQUIREMENTS.md` -- DIGEST-01 through DIGEST-05 definitions
- `.planning/ROADMAP.md` -- Phase 19 success criteria and plan structure
- `.planning/phases/17-srs-quiz-backend/17-RESEARCH.md` -- SRS interval context, card creation patterns

### Secondary (MEDIUM confidence)
- Cowan, N. (2001). The magical number 4 in short-term memory. Behavioral and Brain Sciences. Working memory capacity supports 10-15 item session size.
- Kruglanski, A. W., & Webster, D. M. (1996). Motivated closing of the mind. Psychological Review. Cognitive closure theory basis for end-of-session summary screen.
- Interleaving effect: Mixing review and new material in a single session improves retention vs. blocked practice (Rohrer & Taylor, 2007).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Zero new dependencies, all modifications to existing code and patterns
- Architecture: HIGH - All patterns directly derived from reading the existing quiz/review infrastructure
- Pitfalls: HIGH - Identified from actual code analysis (session tracking, empty state handling, streak computation)

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- no external dependency changes expected)
