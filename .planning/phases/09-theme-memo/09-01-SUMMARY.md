---
phase: 09-theme-memo
plan: 01
subsystem: api, ui
tags: [prisma, express, react-native, mistral, react-query, markdown, llm, caching]

# Dependency graph
requires:
  - phase: 08-theme-quiz-existing-cards
    provides: "Theme detail screen with quiz button, ContentTheme join table"
  - phase: 05-theme-data-model-api
    provides: "Theme model, themeRouter, content-theme endpoints"
provides:
  - "GET /api/themes/:id/memo endpoint with 24h server-side TTL cache"
  - "POST /api/themes/:id/memo/refresh endpoint for force-refresh"
  - "Theme.memo and Theme.memoGeneratedAt Prisma fields"
  - "useThemeMemo and useRefreshThemeMemo React Query hooks"
  - "ios/app/memo/theme/[id].tsx screen with Markdown rendering"
  - "Memo button on theme detail screen"
  - "Cache invalidation on content add/remove from theme"
affects: [10-synthesis-quiz, theme-detail, theme-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side LLM memo caching with 24h TTL on Prisma model fields"
    - "Cache invalidation on content-theme association changes"
    - "Generate-on-first-view pattern with lazy TTL checking"

key-files:
  created:
    - "ios/app/memo/theme/[id].tsx"
  modified:
    - "backend/prisma/schema.prisma"
    - "backend/src/routes/themes.ts"
    - "ios/hooks/useMemo.ts"
    - "ios/hooks/index.ts"
    - "ios/app/theme/[id].tsx"
    - "ios/app/_layout.tsx"

key-decisions:
  - "Theme memo cached directly on Theme model (memo + memoGeneratedAt fields) rather than JSON hack"
  - "24h TTL with lazy invalidation at read time (no cron needed)"
  - "Cache cleared on content add/remove from theme for freshness"
  - "Memo button always enabled on theme detail (error handling on memo screen itself)"
  - "Cap at 15 content memos per synthesis prompt to stay within LLM context limits"
  - "400 word max for theme synthesis (up from 300 for topic memos)"

patterns-established:
  - "Server-side memo caching: nullable String + DateTime fields on model, TTL check at read time"
  - "Force-refresh endpoint: POST that bypasses cache, same generation logic"

# Metrics
duration: 5min
completed: 2026-02-11
---

# Phase 9 Plan 01: Theme Memo Summary

**Theme synthesis memo API with 24h server-side caching, LLM aggregation of per-content memos, and iOS screen with Markdown rendering and force-refresh**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-11T09:09:35Z
- **Completed:** 2026-02-11T09:14:15Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Theme memo API generates LLM synthesis from per-content memos, cached in Theme row with 24h TTL
- iOS theme memo screen displays Markdown content with share, refresh, and back navigation
- Memo button on theme detail screen navigates to memo screen
- Cache automatically cleared when content is added to or removed from theme
- Force-refresh endpoint bypasses cache for on-demand regeneration

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend theme memo schema + endpoints** - `e4a80fd` (feat)
2. **Task 2: iOS theme memo screen, hooks, and navigation** - `b80563d` (feat)

## Files Created/Modified
- `backend/prisma/schema.prisma` - Added memo and memoGeneratedAt nullable fields to Theme model
- `backend/src/routes/themes.ts` - Added GET /:id/memo (cached), POST /:id/memo/refresh, cache invalidation on content changes
- `ios/hooks/useMemo.ts` - Added useThemeMemo and useRefreshThemeMemo hooks
- `ios/hooks/index.ts` - Exported new theme memo hooks
- `ios/app/memo/theme/[id].tsx` - New theme memo screen with Markdown rendering, share, refresh buttons
- `ios/app/theme/[id].tsx` - Added Memo button below Quiz button on theme detail
- `ios/app/_layout.tsx` - Registered memo/theme/[id] route

## Decisions Made
- Theme memo cached directly on Theme model fields (not JSON hack like per-content memos) for cleaner Prisma-level TTL checking
- 24h TTL with lazy invalidation at read time -- no cron job needed
- Cache cleared on content add/remove from theme so next view gets fresh generation
- Memo button always enabled on theme detail -- error handling happens on memo screen (avoids extra API call on theme detail load)
- Capped at 15 content memos per synthesis prompt to stay within LLM context limits
- Used 400 word max for theme synthesis (vs 300 for topic memos, reflecting broader scope)
- Wrapped Memo button in View for marginTop instead of passing style prop to Button (Button component does not accept style prop)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Button style prop type error**
- **Found during:** Task 2 (iOS theme memo screen)
- **Issue:** Plan specified `marginTop: spacing.sm` as a style prop on Button, but the Button component does not accept a `style` prop
- **Fix:** Wrapped the Memo Button in a View with the marginTop style instead
- **Files modified:** ios/app/theme/[id].tsx
- **Verification:** `npx tsc --noEmit` shows only pre-existing errors, no new errors from our changes
- **Committed in:** b80563d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor styling adjustment. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Theme memo feature complete, ready for Phase 10 (Synthesis Quiz from theme memos)
- Backend schema needs `prisma db push` on VPS during deployment
- Deploy command: `ssh root@116.203.17.203 "cd /root/Remember/backend && git pull && npx prisma db push && npx prisma generate && npm run build && pm2 restart remember-api"`

## Self-Check: PASSED

All 7 files verified present. Both task commits (e4a80fd, b80563d) verified in git log.

---
*Phase: 09-theme-memo*
*Completed: 2026-02-11*
