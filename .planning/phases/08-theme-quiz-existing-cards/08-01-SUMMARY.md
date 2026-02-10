---
phase: 08-theme-quiz-existing-cards
plan: 01
subsystem: api, ui
tags: [express, prisma, react-native, expo-router, react-query, quiz, themes]

# Dependency graph
requires:
  - phase: 07-ios-theme-screens
    provides: Theme detail screen, theme CRUD API, ThemeListItem type
  - phase: 05-theme-data-model-api
    provides: Theme model, ContentTheme join table, themes API routes
provides:
  - POST /reviews/practice/theme endpoint (cards from theme content, shuffled, capped at 20)
  - quizReadyCount and canQuiz fields on GET /themes/:id response
  - useThemeQuiz hook for iOS
  - quiz/theme/[id].tsx screen (theme-scoped quiz UI)
  - Smart quiz button on theme detail (disabled when < 3 quizzable content)
affects: [09-theme-memos, 10-synthesis-quiz]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Theme quiz follows same pattern as topic quiz (practice endpoint + dedicated screen)"
    - "Quiz readiness check via parallel Promise.all query in theme detail endpoint"

key-files:
  created:
    - ios/app/quiz/theme/[id].tsx
  modified:
    - backend/src/routes/review.ts
    - backend/src/routes/themes.ts
    - ios/hooks/useQuiz.ts
    - ios/hooks/index.ts
    - ios/types/content.ts
    - ios/app/theme/[id].tsx
    - ios/app/_layout.tsx

key-decisions:
  - "Cap theme quiz at 20 questions to prevent overwhelming sessions"
  - "Theme quiz updates SM-2 stats (not practice mode) consistent with topic quiz"
  - "View memo button on quiz summary routes to theme detail (theme memos come in Phase 9)"
  - "Quiz button always visible on theme detail (not hidden in empty state)"

patterns-established:
  - "Theme quiz endpoint pattern: verify ownership, find READY content via ContentTheme join, enforce threshold, fetch cards, shuffle, cap"
  - "Quiz readiness enrichment: add count query to existing Promise.all in detail endpoint"

# Metrics
duration: 3min
completed: 2026-02-10
---

# Phase 8 Plan 1: Theme Quiz (Existing Cards) Summary

**Theme-scoped quiz API endpoint aggregating cards via ContentTheme join table, iOS quiz screen reusing existing quiz components, and smart quiz button with 3-content minimum threshold**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-10T22:42:45Z
- **Completed:** 2026-02-10T22:46:00Z
- **Tasks:** 2
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments
- Backend POST /reviews/practice/theme endpoint returns shuffled cards from all theme content, capped at 20, with 3-content minimum enforcement
- GET /themes/:id now includes quizReadyCount and canQuiz fields for frontend quiz readiness checks
- New iOS quiz screen at quiz/theme/[id].tsx with full question/feedback/summary state machine
- Theme detail quiz button correctly enables/disables based on canQuiz, shows "X/3 contenus" hint when disabled
- Theme quiz answers update SM-2 scheduling (consistent with topic/content quiz behavior)

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend theme quiz endpoint and quiz readiness enrichment** - `5e537bc` (feat)
2. **Task 2: iOS theme quiz screen, hook, types, and smart quiz button** - `c5f2466` (feat)

## Files Created/Modified
- `backend/src/routes/review.ts` - Added POST /reviews/practice/theme endpoint
- `backend/src/routes/themes.ts` - Added quizReadyCount and canQuiz to GET /:id response
- `ios/app/quiz/theme/[id].tsx` - New theme quiz screen (question/feedback/summary states)
- `ios/hooks/useQuiz.ts` - Added useThemeQuiz hook and ThemePracticeResponse interface
- `ios/hooks/index.ts` - Exported useThemeQuiz
- `ios/types/content.ts` - Added quizReadyCount and canQuiz to ThemeListItem
- `ios/app/theme/[id].tsx` - Updated quiz button to route to quiz/theme/[id] with disabled state
- `ios/app/_layout.tsx` - Registered quiz/theme/[id] route

## Decisions Made
- Cap theme quiz at 20 questions (prevents overwhelming sessions for themes with many contents)
- Theme quiz updates SM-2 stats (not practice mode) -- consistent with topic quiz behavior
- "View memo" button on quiz summary routes back to theme detail screen until Phase 9 adds theme memos
- Quiz button always visible on theme detail screen (moved outside content list conditional)
- Used `as any` for route pathname type in handleViewMemo (consistent with existing pattern in codebase)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript route type error in theme quiz screen**
- **Found during:** Task 2 (iOS theme quiz screen)
- **Issue:** `pathname: '/theme/[id]'` in handleViewMemo caused TS2322 because expo-router's generated types don't include the new route yet
- **Fix:** Added `as any` cast on pathname (same pattern used in handleManageTheme in theme detail screen)
- **Files modified:** ios/app/quiz/theme/[id].tsx
- **Verification:** `npx tsc --noEmit` shows no errors from new files
- **Committed in:** c5f2466 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type cast fix, consistent with existing codebase patterns. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Theme quiz flow is complete end-to-end (API + iOS screen)
- Ready for Phase 9 (theme memos) which will provide a proper memo destination from quiz summary
- Ready for Phase 10 (synthesis quiz) which will add cross-content synthesis questions

## Self-Check: PASSED

All 9 files verified present. Both task commits (5e537bc, c5f2466) verified in git log. All must_have artifacts confirmed: practice/theme endpoint, quizReadyCount field, canQuiz field, useThemeQuiz export, quiz/theme/[id].tsx screen (173 lines), key_links verified.

---
*Phase: 08-theme-quiz-existing-cards*
*Completed: 2026-02-10*
