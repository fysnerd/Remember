---
phase: 11-theme-discovery-onboarding
plan: 01
subsystem: api
tags: [prisma, express, zod, sql, themes, discovery, progress]

# Dependency graph
requires:
  - phase: 05-theme-data-model-api
    provides: Theme model, themeRouter, ContentTheme join table
  - phase: 06-theme-classification-worker
    provides: AI-generated themes with null discoveredAt
provides:
  - discoveredAt nullable DateTime field on Theme model
  - GET /themes status filter (discovered/pending/all)
  - Per-theme progress aggregation (totalCards, masteredCards, dueCards, masteryPercent)
  - POST /themes/discover bulk actions endpoint (confirm/rename/merge/dismiss)
  - User-created themes auto-discovered
affects: [11-02-ios-discovery-onboarding-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [discoveredAt gate pattern, discriminated union Zod schema, raw SQL progress aggregation]

key-files:
  created: []
  modified:
    - backend/prisma/schema.prisma
    - backend/src/routes/themes.ts

key-decisions:
  - "discoveredAt null = pending discovery, set = user confirmed (gate pattern)"
  - "Mastery threshold: repetitions >= 3 (practical for early users)"
  - "Progress computed via single raw SQL with FILTER clauses (no N+1)"
  - "POST /discover registered before POST / to avoid Express path conflict"
  - "User-created themes set discoveredAt immediately (skip discovery flow)"
  - "Merge clears memo cache and synthesis quizzes on target theme"

patterns-established:
  - "Discovery gate: discoveredAt field controls theme visibility without separate status enum"
  - "Bulk action endpoint: discriminatedUnion Zod schema + $transaction for atomic multi-action processing"

# Metrics
duration: 5min
completed: 2026-02-11
---

# Phase 11 Plan 01: Theme Discovery Backend Summary

**discoveredAt gate field on Theme model with status-filtered GET /themes, per-theme mastery progress, and bulk POST /themes/discover endpoint for confirm/rename/merge/dismiss**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-11T10:16:37Z
- **Completed:** 2026-02-11T10:21:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added discoveredAt nullable DateTime to Theme model with backfill of existing themes
- GET /themes now returns only discovered themes by default with per-theme mastery progress (totalCards, masteredCards, dueCards, masteryPercent)
- POST /themes/discover handles bulk confirm/rename/merge/dismiss atomically in a single transaction
- User-created themes are immediately discovered (skip discovery flow)
- Backend deployed and operational on VPS

## Task Commits

Each task was committed atomically:

1. **Task 1: Add discoveredAt field to Theme model and deploy migration** - `e53f7b8` (feat)
2. **Task 2: Add status filter, progress aggregation, and bulk discovery endpoint** - `2bc480d` (feat)

## Files Created/Modified
- `backend/prisma/schema.prisma` - Added discoveredAt nullable DateTime field to Theme model
- `backend/src/routes/themes.ts` - Status filter on GET /, progress aggregation SQL, POST /discover endpoint, discoveredAt on POST /

## Decisions Made
- discoveredAt null = pending discovery, set = user confirmed -- simpler than a separate status enum
- Mastery threshold set at repetitions >= 3 per research recommendation (works for early users)
- Progress computed via single raw SQL with PostgreSQL FILTER clauses (no N+1 queries)
- POST /discover registered before POST / to prevent Express matching "discover" as a param
- User-created themes auto-set discoveredAt (they skip the discovery flow)
- Merge action clears memo cache and synthesis quizzes on target theme for data freshness

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] VPS Prisma client regeneration needed**
- **Found during:** Task 2 (VPS deployment)
- **Issue:** VPS had old Prisma client without discoveredAt field, build failed with type errors
- **Fix:** Ran `npx prisma generate && npx prisma db push` on VPS before building
- **Files modified:** None (runtime only)
- **Verification:** Build succeeded, PM2 restarted cleanly
- **Committed in:** N/A (deploy-time fix)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Standard deploy-time issue. No scope creep.

## Issues Encountered
- VPS needed Prisma client regeneration before the new schema fields were available -- resolved by running `prisma generate` before build

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend API fully ready for iOS discovery UI (Plan 11-02)
- GET /themes?status=pending returns AI-generated themes awaiting user review
- POST /themes/discover endpoint ready to process user decisions from onboarding flow
- Progress fields (masteryPercent, dueCards) available for theme card display

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 11-theme-discovery-onboarding*
*Completed: 2026-02-11*
