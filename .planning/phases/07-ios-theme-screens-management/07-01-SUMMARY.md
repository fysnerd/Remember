---
phase: 07-ios-theme-screens-management
plan: 01
subsystem: ui
tags: [react-native, expo-router, react-query, themes, navigation, typescript]

# Dependency graph
requires:
  - phase: 05-theme-data-model-api
    provides: Theme REST API endpoints (GET /themes, GET /themes/:id, POST/PUT/DELETE /themes, content association)
  - phase: 06-theme-classification-worker
    provides: AI-generated themes with content associations
provides:
  - ThemeListItem and ThemeRef TypeScript types for iOS
  - React Query hooks for all theme CRUD operations (7 hooks)
  - ThemeCard component with emoji, name, color bar, content count
  - Redesigned home screen with ThemeCard 2-column grid replacing Topics grid
  - Theme detail screen with content list, pull-to-refresh, and quiz button
  - Route registration for theme/[id], theme/manage/[id], theme-create
affects: [07-02 theme management screens, 08 theme quiz, ios UX]

# Tech tracking
tech-stack:
  added: []
  patterns: [ThemeCard component pattern, theme hooks pattern mirroring useTopics]

key-files:
  created:
    - ios/hooks/useThemes.ts
    - ios/components/ThemeCard.tsx
    - ios/app/theme/[id].tsx
  modified:
    - ios/types/content.ts
    - ios/hooks/index.ts
    - ios/app/(tabs)/index.tsx
    - ios/app/_layout.tsx

key-decisions:
  - "Used 'as any' type cast for theme route pathname to work around expo-router typed routes not auto-regenerating during build"
  - "Quiz button on theme detail reuses existing /quiz/topic/[name] flow by theme name until Phase 8 adds dedicated theme quiz"
  - "Pre-registered theme/manage/[id] and theme-create routes in _layout.tsx for Plan 07-02"

patterns-established:
  - "ThemeCard: pressable card with color bar accent, emoji, name, count -- reusable for any theme listing"
  - "Theme hooks follow same React Query pattern as useTopics (query keys, invalidation, mutation structure)"

# Metrics
duration: 3min
completed: 2026-02-10
---

# Phase 7 Plan 01: Theme Navigation Layer Summary

**ThemeCard component, React Query hooks for 7 theme CRUD operations, redesigned home screen with 2-column theme grid, and theme detail screen with content list and pull-to-refresh**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-10T18:04:07Z
- **Completed:** 2026-02-10T18:07:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created ThemeListItem and ThemeRef TypeScript types for theme data
- Built 7 React Query hooks (useThemes, useThemeDetail, useCreateTheme, useUpdateTheme, useDeleteTheme, useAddContentToTheme, useRemoveContentFromTheme) matching backend API contract
- Created ThemeCard component with emoji, color accent bar, name, and content count
- Redesigned home/feed screen replacing plain-text Topics grid with rich ThemeCard 2-column grid
- Created theme detail screen with theme header, scrollable content list, pull-to-refresh, gear settings button, and quiz button
- Registered 3 new routes (theme/[id], theme/manage/[id], theme-create) in root layout

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Theme types, React Query hooks, and hook exports** - `74584fa` (feat)
2. **Task 2: Create ThemeCard component, redesign home screen, create theme detail screen, register routes** - `8c05279` (feat)

## Files Created/Modified
- `ios/types/content.ts` - Added ThemeListItem and ThemeRef interfaces
- `ios/hooks/useThemes.ts` - 7 React Query hooks for theme CRUD operations
- `ios/hooks/index.ts` - Re-exports for all theme hooks
- `ios/components/ThemeCard.tsx` - Pressable card with emoji, color bar, name, count
- `ios/app/(tabs)/index.tsx` - Redesigned feed screen with ThemeCard grid replacing Topics grid
- `ios/app/theme/[id].tsx` - Theme detail screen with content list and pull-to-refresh
- `ios/app/_layout.tsx` - Route registration for theme/[id], theme/manage/[id], theme-create

## Decisions Made
- Used `as any` type cast for theme route pathname to work around expo-router typed routes not auto-regenerating during build (same pattern already used in theme detail screen for manage route)
- Quiz button on theme detail reuses existing `/quiz/topic/[name]` flow by theme name until Phase 8 adds dedicated theme quiz
- Pre-registered `theme/manage/[id]` and `theme-create` routes in `_layout.tsx` so Plan 07-02 does not need to touch the root layout

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed expo-router typed route error for /theme/[id]**
- **Found during:** Task 2 (Home screen rewrite)
- **Issue:** TypeScript error TS2322 - expo-router auto-generated typed routes did not include `/theme/[id]` since the route file was just created
- **Fix:** Added `as any` type cast on the pathname in `router.push()` call, consistent with the pattern used in the theme detail screen for `/theme/manage/[id]`
- **Files modified:** `ios/app/(tabs)/index.tsx`
- **Verification:** TypeScript compilation passes with only pre-existing errors (5 in unrelated files)
- **Committed in:** `8c05279` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal -- standard expo-router typed routes workaround. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Theme navigation flow is complete (home grid -> theme detail -> content)
- Ready for Plan 07-02: Theme management screens (create, edit, delete, content association)
- Routes for management screens already registered in _layout.tsx

## Self-Check: PASSED

All 8 files verified present. Both task commits (74584fa, 8c05279) verified in git log.

---
*Phase: 07-ios-theme-screens-management*
*Completed: 2026-02-10*
