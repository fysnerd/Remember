---
phase: 19-daily-digest
plan: 01
subsystem: api
tags: [express, prisma, react-query, srs, digest, mutation]

# Dependency graph
requires:
  - phase: 17-srs-quiz-backend
    provides: SM-2 scheduling, card/quiz models, /reviews/due query patterns
provides:
  - POST /api/reviews/digest endpoint with card selection algorithm
  - useDigestCards mutation hook with DigestCard/DigestResponse types
  - Auto-created QuizSession on digest fetch
affects: [19-daily-digest plan 02, home screen integration, digest session UI]

# Tech tracking
tech-stack:
  added: []
  patterns: [digest card selection (SRS due priority + new card fill), mutation-based fetch for side-effect endpoints]

key-files:
  created:
    - ios/hooks/useDigest.ts
  modified:
    - backend/src/routes/review.ts
    - ios/hooks/index.ts

key-decisions:
  - "useMutation for digest fetch (not useQuery) to prevent duplicate QuizSession creation on re-fetches"
  - "No hard minimum enforced on digest size -- return whatever cards are available (per research recommendation)"
  - "Underscore prefix removed for MIN_DIGEST constant; used comment instead (noUnusedLocals strict mode)"
  - "Include quiz.theme in digest card response for future UI theme indicators"

patterns-established:
  - "Side-effect endpoints use useMutation to prevent accidental re-creation"
  - "Card selection: SRS due priority (most overdue first) + new card fill to MAX cap + shuffle"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 19 Plan 01: Digest Card Selection Summary

**POST /reviews/digest endpoint with SRS-priority card selection algorithm and useDigestCards mutation hook**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T14:35:26Z
- **Completed:** 2026-02-16T14:37:55Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Backend endpoint that builds 10-15 card daily digest: SRS due cards first (most overdue), remaining slots filled with new cards respecting daily limit, shuffled for interleaving
- Auto-creates QuizSession with mode 'due' so answers are tracked and session appears in review history
- Empty digest returns structured response with reason 'no_cards_due' for frontend empty state handling
- Frontend useDigestCards mutation hook with full TypeScript interfaces matching backend response shape

## Task Commits

Each task was committed atomically:

1. **Task 1: Add POST /reviews/digest endpoint** - `dda5a9b` (feat)
2. **Task 2: Create useDigest hook and export from hooks index** - `764ce85` (feat)

## Files Created/Modified
- `backend/src/routes/review.ts` - Added POST /reviews/digest endpoint with card selection algorithm (135 lines)
- `ios/hooks/useDigest.ts` - New file: DigestCard/DigestResponse types + useDigestCards mutation hook
- `ios/hooks/index.ts` - Added useDigestCards export and DigestCard/DigestResponse type exports

## Decisions Made
- Used `useMutation` instead of `useQuery` for the digest fetch because the endpoint creates a QuizSession as a side effect -- prevents accidental duplicate session creation from staleTime refetch, focus refetch, etc.
- Removed MIN_DIGEST constant (noUnusedLocals strict mode) and replaced with comment. No hard minimum enforced per research recommendation: a digest of 5 questions is better than no digest.
- Included `quiz.theme` (id, name) in the card include structure beyond what `/reviews/due` returns, anticipating theme indicators in the digest UI (Plan 19-02).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed MIN_DIGEST unused variable TypeScript error**
- **Found during:** Task 1 (digest endpoint)
- **Issue:** `MIN_DIGEST` constant declared but never used; backend tsconfig has `noUnusedLocals: true` causing compilation failure
- **Fix:** Removed the constant and replaced with a descriptive comment. Underscore prefix approach does not work for local variables with noUnusedLocals.
- **Files modified:** backend/src/routes/review.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** dda5a9b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor -- constant was informational only per plan spec. No scope creep.

## Issues Encountered
None beyond the MIN_DIGEST unused variable handled above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Digest endpoint ready to be consumed by Plan 19-02 (Digest session UI)
- useDigestCards hook ready for use in ios/app/digest.tsx screen
- QuizSession auto-creation means the existing useCompleteSession and useSubmitAnswer hooks work without modification
- Home screen CTA can use existing useReviewStats for due count display

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 19-daily-digest*
*Completed: 2026-02-16*
