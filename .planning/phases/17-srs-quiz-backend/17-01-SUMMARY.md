---
phase: 17-srs-quiz-backend
plan: 01
subsystem: api
tags: [sm-2, srs, spaced-repetition, prisma, express]

# Dependency graph
requires: []
provides:
  - "FIXED_INTERVALS map (J+1/J+3/J+7/J+31) for SRS review scheduling"
  - "Explicit nextReviewAt = now + 24h on all card.create calls"
  - "EASY bonus restricted to dynamic interval phase (rep > 4)"
affects: [17-02-PLAN, quiz-frontend, daily-digest]

# Tech tracking
tech-stack:
  added: []
  patterns: ["fixed-interval-then-dynamic SRS scheduling"]

key-files:
  created: []
  modified:
    - backend/src/routes/review.ts
    - backend/src/services/quizGeneration.ts

key-decisions:
  - "FIXED_INTERVALS defined inline in review handler, not as module-level constant, to keep scope tight"
  - "cardNextReview computed once before the loop (shared Date for all cards in same batch)"
  - "Prisma schema @default(now()) kept as fallback but overridden by explicit nextReviewAt in code"

patterns-established:
  - "SRS scheduling: fixed intervals for reps 1-4, SM-2 dynamic for reps > 4"
  - "Card creation: always pass explicit nextReviewAt (never rely on schema default for scheduling)"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 17 Plan 01: SRS Fixed Intervals Summary

**Fixed interval SRS scheduling (J+1/J+3/J+7/J+31) replacing pure SM-2, with J+1 delay on all new card creation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T13:20:41Z
- **Completed:** 2026-02-16T13:23:04Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced SM-2 dynamic intervals with fixed interval map (J+1/J+3/J+7/J+31) for the first 4 repetitions
- Restricted EASY bonus to dynamic interval phase only (rep > 4), preventing interval inflation during learning
- All 3 card.create sites in the codebase now pass explicit nextReviewAt = now + 24h, ensuring new cards are never due immediately

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace SM-2 dynamic intervals with fixed interval map in review.ts + add J+1 to synthesis card creation** - `7d17af8` (feat)
2. **Task 2: Add J+1 nextReviewAt to both card.create calls in quizGeneration.ts** - `40792e2` (feat)

## Files Created/Modified
- `backend/src/routes/review.ts` - FIXED_INTERVALS map for SRS scheduling, EASY bonus restricted to rep > 4, synthesis card.create gets explicit nextReviewAt
- `backend/src/services/quizGeneration.ts` - processContentQuiz and regenerateQuiz card.create calls both pass explicit nextReviewAt = now + 24h

## Decisions Made
- FIXED_INTERVALS defined inline in the review handler (not module-level) to keep the constant close to its usage and avoid polluting module scope
- Computed cardNextReview once before the for loop and reused for all cards in the same batch (all cards from one generation share the same nextReviewAt)
- Kept the Prisma schema `@default(now())` on nextReviewAt as a fallback but always override it explicitly in code

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SRS scheduling engine is aligned to research-backed intervals, ready for Plan 17-02 (self-referential quiz prompts)
- Backend deploy needed to activate changes on production (ssh + git pull + build + pm2 restart)

## Self-Check: PASSED

- [x] backend/src/routes/review.ts - FOUND
- [x] backend/src/services/quizGeneration.ts - FOUND
- [x] 17-01-SUMMARY.md - FOUND
- [x] Commit 7d17af8 - FOUND
- [x] Commit 40792e2 - FOUND

---
*Phase: 17-srs-quiz-backend*
*Completed: 2026-02-16*
