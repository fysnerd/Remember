---
phase: 20-pipeline-feedback
plan: 01
subsystem: ui, api
tags: [react-native, polling, react-query, haptics, reanimated, prisma, pipeline-status]

# Dependency graph
requires:
  - phase: 18-swipe-triage
    provides: ContentCard component and triage flow
  - phase: 19-daily-digest
    provides: Digest session UI and hooks pattern
provides:
  - GET /content/pipeline-status batch endpoint for processing content
  - usePipelineStatus conditional polling hook
  - PipelineStatusBadge overlay component for ContentCard
  - ContentStatus type extended with FAILED and UNSUPPORTED
  - Content detail auto-refresh during processing states
affects: [content-card-consumers, theme-detail, library-grid]

# Tech tracking
tech-stack:
  added: []
  patterns: [conditional-polling-refetchInterval, processing-map-lookup, reanimated-badge-animation]

key-files:
  created:
    - ios/hooks/usePipelineStatus.ts
    - ios/components/content/PipelineStatusBadge.tsx
  modified:
    - backend/src/routes/content.ts
    - ios/types/content.ts
    - ios/hooks/index.ts
    - ios/components/content/ContentCard.tsx
    - ios/components/content/index.ts
    - ios/app/content/[id].tsx

key-decisions:
  - "Pipeline-status endpoint placed BEFORE /:id catch-all to avoid Express param collision"
  - "Haptic + query invalidation as ready transition feedback (no blocking Alert or toast)"
  - "5s polling interval with conditional refetchInterval that returns false when idle"
  - "PipelineStatusBadge uses reanimated FadeIn/FadeOut for smooth appearance/disappearance"
  - "Content detail uses setInterval+refetch pattern instead of modifying useContent hook"

patterns-established:
  - "Conditional polling: refetchInterval callback returns interval or false based on data state"
  - "Processing map: Map<id, status> for O(1) lookup by ContentCard consumers"
  - "Badge overlay: positioned absolute bottom-left to avoid overlap with source/duration/selection overlays"

# Metrics
duration: 4min
completed: 2026-02-16
---

# Phase 20 Plan 01: Pipeline Feedback Summary

**Real-time pipeline status badges on content cards with conditional 5s polling, per-status text on detail screen, and haptic feedback on ready transitions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-16T15:14:19Z
- **Completed:** 2026-02-16T15:18:35Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Backend GET /content/pipeline-status endpoint returns processing items and recently-ready items for transition detection
- usePipelineStatus hook polls every 5s only when processing items exist, stops when idle (no battery drain)
- PipelineStatusBadge shows animated status overlay (En attente / Transcription / Quiz en creation / Erreur / Non supporte) on ContentCard thumbnails
- Content detail screen shows 5 distinct status texts instead of generic "Quiz en preparation..."
- Content detail auto-refreshes every 5s while content is in processing state, seamlessly transitioning to "Faire le quiz" when ready
- Ready transitions trigger haptic feedback and content query invalidation for instant UI updates

## Task Commits

Each task was committed atomically:

1. **Task 1: Add batch pipeline-status endpoint and iOS polling hook** - `d0e17bf` (feat)
2. **Task 2: Add status badges to ContentCard and enhance content detail screen** - `bd1524d` (feat)

## Files Created/Modified
- `backend/src/routes/content.ts` - Added GET /content/pipeline-status endpoint before /:id routes
- `ios/types/content.ts` - Extended ContentStatus with FAILED/UNSUPPORTED, added PipelineStatusResponse types
- `ios/hooks/usePipelineStatus.ts` - Conditional polling hook with ready transition detection
- `ios/hooks/index.ts` - Export usePipelineStatus
- `ios/components/content/PipelineStatusBadge.tsx` - Animated badge overlay with per-status icon and label
- `ios/components/content/ContentCard.tsx` - Added optional status prop, renders PipelineStatusBadge
- `ios/components/content/index.ts` - Export PipelineStatusBadge
- `ios/app/content/[id].tsx` - Status-aware button text, auto-refresh polling during processing

## Decisions Made
- Pipeline-status endpoint placed before /:id catch-all routes to prevent Express treating "pipeline-status" as an id parameter
- Used haptic feedback + query invalidation (not Alert or toast) for ready transitions to avoid blocking UI
- Content detail uses local setInterval+refetch rather than modifying useContent hook to keep changes scoped
- PipelineStatusBadge positioned bottom-left of thumbnail (source badge is top-left, duration is bottom-right, selection is top-right)
- Used theme.ts `colors.success` and `colors.error` for GENERATING and FAILED badge colors respectively

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing onPress on disabled Button in content detail**
- **Found during:** Task 2 (content detail screen enhancement)
- **Issue:** Pre-existing TS error: disabled Button lacked required `onPress` prop per ButtonProps interface
- **Fix:** Added `onPress={() => {}}` no-op to the disabled button
- **Files modified:** ios/app/content/[id].tsx
- **Verification:** `npx tsc --noEmit` no longer reports this error
- **Committed in:** bd1524d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Trivial fix for pre-existing TS error. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Pipeline feedback UI is complete and ready for production
- ContentCard `status` prop is optional -- existing call sites work without changes
- To activate badges in library/theme grids, consumers need to pass `status` from content data or `processingMap`
- Backend endpoint is ready for deployment via `git pull && npm run build && pm2 restart`

## Self-Check: PASSED

All 8 created/modified files verified present on disk. Both task commits (d0e17bf, bd1524d) verified in git log.

---
*Phase: 20-pipeline-feedback*
*Completed: 2026-02-16*
