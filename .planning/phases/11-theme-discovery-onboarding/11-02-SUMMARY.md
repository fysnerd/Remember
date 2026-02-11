---
phase: 11-theme-discovery-onboarding
plan: 02
subsystem: ui
tags: [react-native, expo-router, zustand, tanstack-query, themes, discovery, onboarding, progress]

# Dependency graph
requires:
  - phase: 11-theme-discovery-onboarding
    provides: discoveredAt gate, status filter, progress aggregation, POST /themes/discover endpoint
  - phase: 07-ios-theme-screens
    provides: ThemeCard component, theme navigation, _layout.tsx route registration
provides:
  - iOS theme discovery onboarding screen (rename, merge, dismiss pending themes)
  - Discovery banner on home screen when pending themes exist
  - ThemeCard mastery progress bar and due card count badge
  - usePendingThemes and useDiscoverThemes React Query hooks
  - DiscoverAction union type for bulk discovery actions
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [local editing state with Maps/Sets before bulk API submit, inline TextInput editing on tap, merge picker modal]

key-files:
  created:
    - ios/app/theme-discovery.tsx
    - ios/components/DiscoveryThemeCard.tsx
  modified:
    - ios/types/content.ts
    - ios/hooks/useThemes.ts
    - ios/hooks/index.ts
    - ios/components/ThemeCard.tsx
    - ios/app/(tabs)/index.tsx
    - ios/app/_layout.tsx

key-decisions:
  - "Local Maps/Sets for edit state (editedNames, dismissedIds, merges) before single bulk API call"
  - "Inline TextInput rename on tap (not separate modal) for faster editing"
  - "Merge picker as pageSheet modal with FlatList of remaining themes"
  - "Discovery banner non-blocking (above theme grid, not hard redirect)"
  - "Fixed useThemes to extract data.themes from API response (was returning wrapper object)"

patterns-established:
  - "Bulk action pattern: accumulate local edits then submit as single API call with DiscoverAction[]"
  - "Conditional badge pattern: only render due badge when dueCards > 0"

# Metrics
duration: 5min
completed: 2026-02-11
---

# Phase 11 Plan 02: iOS Theme Discovery Onboarding UI Summary

**Discovery onboarding screen with rename/merge/dismiss, ThemeCard mastery progress bar and due badge, and home screen discovery banner for pending themes**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-11T10:24:07Z
- **Completed:** 2026-02-11T10:29:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Built full discovery onboarding screen where users review, rename, merge, or dismiss AI-generated themes before confirmation
- Added mastery progress bar (width proportional to masteryPercent) and due card count badge to ThemeCard
- Added discovery banner on home screen showing pending theme count with navigation to discovery flow
- Created usePendingThemes and useDiscoverThemes hooks with proper API response extraction
- Fixed useThemes hook to correctly extract `data.themes` from `{ themes: [...] }` API response

## Task Commits

Each task was committed atomically:

1. **Task 1: Update types and hooks for discovery flow and progress data** - `e84df9d` (feat)
2. **Task 2: Build ThemeCard progress UI, DiscoveryThemeCard, discovery screen, and home screen banner** - `f0a91fd` (feat)

## Files Created/Modified
- `ios/types/content.ts` - Added totalCards, masteredCards, dueCards, masteryPercent to ThemeListItem; added DiscoverAction union type
- `ios/hooks/useThemes.ts` - Fixed useThemes response extraction; added usePendingThemes and useDiscoverThemes hooks
- `ios/hooks/index.ts` - Exported new hooks
- `ios/components/ThemeCard.tsx` - Added mastery progress bar and due badge with optional props
- `ios/components/DiscoveryThemeCard.tsx` - New editable card with inline rename, merge button, dismiss button
- `ios/app/theme-discovery.tsx` - Full discovery screen with local edit state, merge picker modal, bulk confirm
- `ios/app/(tabs)/index.tsx` - Discovery banner above theme grid, progress props passed to ThemeCard
- `ios/app/_layout.tsx` - Registered theme-discovery route

## Decisions Made
- Used local Maps/Sets for edit state (editedNames, dismissedIds, merges) accumulated before single bulk API call -- avoids per-action network roundtrips
- Inline TextInput rename on tap (not separate modal) for faster inline editing
- Merge picker as pageSheet modal with FlatList of remaining visible themes
- Discovery banner is non-blocking (shows above theme grid, not a hard redirect)
- Fixed useThemes to extract `data.themes` from the `{ themes: [...] }` API response wrapper -- was returning the wrapper object instead of the array

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed useThemes response extraction**
- **Found during:** Task 1 (hooks update)
- **Issue:** useThemes hook was typed as `api.get<ThemeListItem[]>('/themes')` but backend returns `{ themes: ThemeListItem[] }` -- Axios data would be the wrapper object, not the array
- **Fix:** Changed to `api.get<{ themes: ThemeListItem[] }>('/themes')` and extracted `data.themes`
- **Files modified:** ios/hooks/useThemes.ts
- **Verification:** TypeScript compiles, consistent with backend response format
- **Committed in:** e84df9d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential correctness fix. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 11 (Theme Discovery & Onboarding) is now complete
- All v2.0 Themes-first UX milestones delivered (Phases 5-11)
- Full flow: AI generates themes -> user reviews in discovery -> confirmed themes show with progress
- Ready for OTA deployment via `eas update --branch production`

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 11-theme-discovery-onboarding*
*Completed: 2026-02-11*
