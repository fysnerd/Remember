---
phase: 15-backend-endpoints
plan: 01
subsystem: api
tags: [express, prisma, mistral-ai, react-query, themes]

# Dependency graph
requires:
  - phase: 14-screen-rebuild
    provides: useDailyThemes stub hook and Explorer SuggestionCard placeholder
provides:
  - GET /api/themes/daily endpoint with scoring algorithm
  - GET /api/themes/suggestions endpoint with AI generation and fallback
  - useDailyThemes hook calling backend instead of client-side sorting
  - useThemeSuggestions hook for Explorer suggestions tab
  - Quiz session completion invalidates daily themes cache
affects: [16-ux-polish, frontend-themes, explorer-tab]

# Tech tracking
tech-stack:
  added: []
  patterns: [scored-theme-selection, llm-with-fallback, named-routes-before-parameterized]

key-files:
  created:
    - ios/hooks/useThemeSuggestions.ts
  modified:
    - backend/src/routes/themes.ts
    - ios/hooks/useDailyThemes.ts
    - ios/hooks/index.ts
    - ios/hooks/useQuiz.ts
    - ios/app/(tabs)/library.tsx

key-decisions:
  - "tags: [] for daily endpoint -- skip join for performance since DailyThemeCard doesn't display tags"
  - "_next prefix for unused NextFunction param in suggestions handler (never 500s, always returns fallback)"
  - "Route ordering: /daily and /suggestions BEFORE /:id to prevent Express param capture"

patterns-established:
  - "LLM endpoints always return fallback on any error -- never 500"
  - "Named routes registered before parameterized routes in Express routers"

# Metrics
duration: 5min
completed: 2026-02-12
---

# Phase 15 Plan 01: Backend Endpoints Summary

**GET /daily with dueCards*3 + newContent*2 + recency scoring, GET /suggestions with Mistral AI and hardcoded fallback, iOS hooks wired to both endpoints**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-12T09:12:16Z
- **Completed:** 2026-02-12T09:16:49Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- GET /api/themes/daily returns top 3 themes scored by due cards, new content, and recency via single raw SQL query
- GET /api/themes/suggestions returns 8 AI-generated theme ideas via Mistral LLM with JSON mode, or hardcoded fallback list on any error
- iOS useDailyThemes hook now fetches from backend instead of client-side sorting stub
- Explorer Suggestions tab renders real AI-generated SuggestionCards with loading skeletons and error fallback
- Quiz session completion invalidates daily themes cache for immediate due count refresh

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GET /daily and GET /suggestions endpoints to themeRouter** - `5173dc5` (feat)
2. **Task 2: Wire iOS hooks and Explorer suggestions tab to new endpoints** - `a0ace86` (feat)

## Files Created/Modified
- `backend/src/routes/themes.ts` - Added GET /daily and GET /suggestions handlers with imports for getLLMClient and llmLimiter
- `ios/hooks/useDailyThemes.ts` - Replaced client-side sorting stub with React Query hook calling /themes/daily
- `ios/hooks/useThemeSuggestions.ts` - New React Query hook for /themes/suggestions with 5min staleTime
- `ios/hooks/index.ts` - Added useThemeSuggestions export
- `ios/hooks/useQuiz.ts` - Added ['themes', 'daily'] invalidation in useCompleteSession onSuccess
- `ios/app/(tabs)/library.tsx` - Wired suggestions tab with useThemeSuggestions, SuggestionCard rendering, Skeleton loading

## Decisions Made
- Return `tags: []` in daily endpoint instead of joining ThemeTag -- DailyThemeCard component doesn't display tags, saves a join
- Prefix unused `next` param as `_next` in suggestions handler -- the catch block always returns fallback JSON, never calls next(error)
- Register /daily and /suggestions routes BEFORE /:id -- Express matches routes in registration order, named routes must precede parameterized ones

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript noUnusedParameters error on suggestions handler**
- **Found during:** Task 1 (backend endpoint implementation)
- **Issue:** `next` parameter in suggestions handler declared but never used (catch returns fallback, never calls next)
- **Fix:** Prefixed parameter as `_next` to satisfy TypeScript strict mode
- **Files modified:** backend/src/routes/themes.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 5173dc5 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor TypeScript strictness fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both endpoints ready for production deployment via `ssh root@116.203.17.203 "cd /root/Remember/backend && git pull && npm run build && pm2 restart remember-api"`
- iOS changes ready for OTA update via `eas update --branch production`
- Explorer Suggestions tab default can be switched from 'library' to 'suggestions' once confirmed working in production

---
*Phase: 15-backend-endpoints*
*Completed: 2026-02-12*
