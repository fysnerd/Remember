---
phase: 10-cross-content-synthesis-quiz
plan: 01
subsystem: api
tags: [prisma, llm, quiz, synthesis, mistral, sm-2]

# Dependency graph
requires:
  - phase: 09-theme-memo
    provides: "Theme memo cached on Theme model, content memos in transcript.segments.memo"
  - phase: 08-theme-quiz
    provides: "POST /practice/theme endpoint for theme-scoped quiz sessions"
  - phase: 05-theme-data-model
    provides: "Theme model, ContentTheme join table"
provides:
  - "Quiz model with nullable contentId, themeId FK, isSynthesis boolean"
  - "generateSynthesisQuestions() service for cross-content LLM question generation"
  - "Extended POST /practice/theme with mixed per-content + synthesis cards"
  - "Synthesis quiz invalidation on theme content changes"
affects: [10-02-ios-synthesis-quiz-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: ["on-demand LLM generation at read time with persistence", "nullable FK for polymorphic quiz ownership"]

key-files:
  created: []
  modified:
    - backend/prisma/schema.prisma
    - backend/src/services/quizGeneration.ts
    - backend/src/routes/review.ts
    - backend/src/routes/themes.ts

key-decisions:
  - "Nullable contentId + themeId FK for dual quiz ownership (content vs theme synthesis)"
  - "On-demand synthesis generation at first theme quiz request, then persisted for SM-2"
  - "Up to 5 synthesis + 15 per-content cards per session, capped at 20 total"
  - "Synthesis quizzes invalidated (deleted) on theme content add/remove"
  - "Per-memo cap at 2000 chars for synthesis prompt to prevent LLM overflow"

patterns-established:
  - "Polymorphic quiz ownership: Quiz.contentId (per-content) OR Quiz.themeId + isSynthesis (synthesis)"
  - "On-demand generation with persistence: generate at read time if missing, persist for SM-2 scheduling"

# Metrics
duration: 5min
completed: 2026-02-11
---

# Phase 10 Plan 01: Cross-Content Synthesis Quiz Summary

**Nullable Quiz.contentId + themeId FK for synthesis questions, generateSynthesisQuestions() LLM service, and extended theme quiz endpoint mixing per-content + synthesis cards**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-11T09:39:16Z
- **Completed:** 2026-02-11T09:43:59Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Quiz model extended with nullable contentId, themeId FK, and isSynthesis boolean for dual ownership (content-scoped vs theme-scoped synthesis)
- generateSynthesisQuestions() generates cross-content questions via LLM requiring 2+ sources, with sourceIndices validation filtering
- POST /practice/theme returns mixed deck: up to 5 synthesis + 15 per-content cards, on-demand synthesis generation on first request
- Synthesis quizzes invalidated on theme content add/remove (both endpoints)

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema change + synthesis question generation service** - `a645b10` (feat)
2. **Task 2: Extend theme quiz endpoint + synthesis cache invalidation** - `0190a08` (feat)

## Files Created/Modified
- `backend/prisma/schema.prisma` - Quiz model with nullable contentId, themeId FK, isSynthesis; Theme model with quizzes relation
- `backend/src/services/quizGeneration.ts` - Added SynthesisGenerationResult interface and generateSynthesisQuestions() exported function
- `backend/src/routes/review.ts` - Extended POST /practice/theme with synthesis fetching, on-demand generation, proportional mixing; null guards for quiz.content
- `backend/src/routes/themes.ts` - Added synthesis quiz deletion on content add/remove (both POST /:id/content and DELETE /:id/content/:contentId)

## Decisions Made
- Nullable contentId + themeId FK for dual quiz ownership (content vs theme synthesis) -- additive change, all existing quiz rows keep their contentId values
- On-demand synthesis generation at first theme quiz request, then persisted for SM-2 scheduling
- Up to 5 synthesis + 15 per-content cards per session, capped at 20 total
- Synthesis quizzes invalidated (deleted) on theme content add/remove -- simpler than selective invalidation
- Per-memo cap at 2000 chars for synthesis prompt to prevent LLM context overflow

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added null guards for quiz.content in session memo and memos endpoints**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** Making contentId nullable caused TypeScript errors in existing code that accessed `review.card.quiz.content` without null checks (session memo generation and memos listing endpoints)
- **Fix:** Added `if (!content) continue;` guards before accessing content properties in both locations
- **Files modified:** backend/src/routes/review.ts (lines ~1010 and ~1317)
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 0190a08 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential for compilation correctness. No scope creep.

## Issues Encountered
None - Prisma generate was needed before TypeScript would recognize new schema fields, which is standard workflow.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend synthesis quiz generation complete, ready for iOS UI integration in Plan 10-02
- POST /practice/theme response includes hasSynthesis and synthesisCount for iOS to differentiate card types
- Each card includes quiz.isSynthesis flag and quiz.theme for synthesis cards (quiz.content for per-content cards)

## Self-Check: PASSED

All files verified present, both commits (a645b10, 0190a08) confirmed in git log.

---
*Phase: 10-cross-content-synthesis-quiz*
*Completed: 2026-02-11*
