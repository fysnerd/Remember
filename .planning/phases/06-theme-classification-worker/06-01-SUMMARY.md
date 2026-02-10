---
phase: 06-theme-classification-worker
plan: 01
subsystem: api
tags: [mistral, llm, prisma, classification, themes, tags, worker]

# Dependency graph
requires:
  - phase: 05-theme-data-model-api
    provides: "Theme, ContentTheme, ThemeTag Prisma models and CRUD API"
provides:
  - "Theme generation service via LLM tag clustering (generateThemesForUser)"
  - "Content classification with deterministic tag matching + LLM fallback (classifyContentForUser)"
  - "Backfill function for bulk processing existing data (runBackfillThemes)"
  - "Shared generateSlug utility for route and service"
affects: [06-02-scheduler-admin-integration, 07-ios-theme-management]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Two-stage worker (generation + classification)", "Deterministic matching before LLM fallback", "Shared utility extraction"]

key-files:
  created:
    - backend/src/utils/slug.ts
    - backend/src/services/themeClassification.ts
  modified:
    - backend/src/routes/themes.ts

key-decisions:
  - "Single-use tags (count=1) filtered before LLM prompt to reduce noise"
  - "Deterministic tag-overlap matching runs before LLM fallback to minimize API costs"
  - "Theme generation gated on 10+ tagged content items per user"
  - "Color validation falls back to palette index if LLM returns non-palette color"
  - "classifyAllContentForUser runs immediately after theme generation for complete initial setup"

patterns-established:
  - "Shared slug utility: import from utils/slug.ts not local definitions"
  - "Two-stage worker pattern: generation for new users, classification for new content"
  - "LLM fallback pattern: deterministic first, LLM only when no tag overlap"

# Metrics
duration: 3min
completed: 2026-02-10
---

# Phase 6 Plan 01: Theme Classification Service Summary

**LLM-powered tag clustering service with Mistral AI generating 5-15 themes per user, deterministic content classification via ThemeTag overlap, and one-time backfill capability**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-10T17:35:04Z
- **Completed:** 2026-02-10T17:37:35Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Created shared `generateSlug` utility extracted from themes.ts route, imported by both route and service
- Built complete theme classification service with 4 exported functions matching the worker pattern from tagging.ts
- Implemented two-stage worker: Stage A generates themes for eligible users, Stage B classifies unthemed content
- Deterministic tag matching before LLM fallback reduces Mistral API costs
- Enforced all safety caps: MAX_THEMES=25, MIN_TAG_USAGE=2, MIN_TAGGED_CONTENT=10
- Backfill function with lower concurrency (pLimit(2)) for gentle bulk processing

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract generateSlug to shared utility and create theme classification service** - `3fab326` (feat)

## Files Created/Modified
- `backend/src/utils/slug.ts` - Shared generateSlug function for URL-safe slugs with French accent handling
- `backend/src/services/themeClassification.ts` - Complete theme generation + classification service (4 exports + 3 internal helpers)
- `backend/src/routes/themes.ts` - Updated to import generateSlug from shared utility instead of local definition

## Decisions Made
- Single-use tags (count=1) filtered before LLM prompt to reduce noise (398/532 production tags are single-use)
- Deterministic tag-overlap matching runs before LLM fallback to minimize Mistral API costs
- Theme generation gated on 10+ tagged content items per user (below that, not enough signal)
- Color validation falls back to palette color by index if LLM returns a non-palette hex value
- classifyAllContentForUser runs immediately after theme generation so users get fully populated themes on first run
- Backfill uses pLimit(2) vs normal pLimit(3) to be gentle on LLM API during bulk processing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Theme classification service is complete and ready for scheduler + admin integration (Plan 06-02)
- All 4 exported functions available: `runThemeClassificationWorker`, `generateThemesForUser`, `classifyContentForUser`, `runBackfillThemes`
- Service follows exact same patterns as existing tagging.ts worker for easy integration

## Self-Check: PASSED

- FOUND: backend/src/utils/slug.ts
- FOUND: backend/src/services/themeClassification.ts
- FOUND: backend/src/routes/themes.ts
- FOUND: commit 3fab326

---
*Phase: 06-theme-classification-worker*
*Completed: 2026-02-10*
