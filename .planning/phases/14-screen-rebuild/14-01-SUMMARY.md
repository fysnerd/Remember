---
phase: 14-screen-rebuild
plan: 01
subsystem: ui
tags: [react-native, glass-ui, home-screen, daily-themes, greeting, review-stats]

# Dependency graph
requires:
  - phase: 13-design-system
    provides: GlassCard, GlassSurface, Text, theme tokens, Lucide icons
provides:
  - GreetingHeader component (time-of-day greeting + review stats)
  - DailyThemeCard component (GlassCard-based theme card)
  - useDailyThemes stub hook (wraps useThemes, sorts by dueCards, takes top 3)
  - Rebuilt Home screen composing all new components
affects: [14-02, 14-03, 15-daily-themes-backend]

# Tech tracking
tech-stack:
  added: []
  patterns: [daily-themes-stub-hook, greeting-time-of-day, glass-card-composition]

key-files:
  created:
    - ios/components/home/GreetingHeader.tsx
    - ios/components/home/DailyThemeCard.tsx
    - ios/hooks/useDailyThemes.ts
  modified:
    - ios/app/(tabs)/index.tsx
    - ios/hooks/index.ts

key-decisions:
  - "useDailyThemes sorts by dueCards desc with updatedAt tiebreaker as Phase 15 stub"
  - "Discovery banner restyled with GlassCard instead of opaque Card with accent border"
  - "Stats row uses middle-dot separator instead of pipe for visual consistency"

patterns-established:
  - "Stub hook pattern: wrap existing hook + sort/slice, with TODO comment for Phase 15 backend endpoint"
  - "Home component extraction: ios/components/home/ directory for Home-screen-specific components"

# Metrics
duration: 2min
completed: 2026-02-12
---

# Phase 14 Plan 01: Home Screen Rebuild Summary

**Rebuilt Home screen from 2-column theme grid to daily learning experience with time-of-day greeting, review stats, and 3 daily theme GlassCards sorted by urgency**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-12T08:46:06Z
- **Completed:** 2026-02-12T08:48:23Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created GreetingHeader with time-of-day greeting (Bonjour/Bon apres-midi/Bonsoir) and review stats
- Created DailyThemeCard using GlassCard with emoji, name, content count, question count, and due badge
- Created useDailyThemes stub hook that wraps useThemes() and returns top 3 themes sorted by dueCards descending
- Completely rewrote Home screen from 2-column grid to focused daily learning layout
- Preserved discovery banner (restyled with GlassCard), pull-to-refresh, and tab bar padding

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GreetingHeader, DailyThemeCard, useDailyThemes** - `387b3fc` (feat)
2. **Task 2: Rewrite Home screen** - `31eb00d` (feat)

## Files Created/Modified
- `ios/hooks/useDailyThemes.ts` - Stub hook wrapping useThemes(), sorts by dueCards desc, takes first 3
- `ios/components/home/GreetingHeader.tsx` - Time-of-day greeting with user name and review stats row
- `ios/components/home/DailyThemeCard.tsx` - GlassCard-based theme card with emoji, name, counts, due badge
- `ios/app/(tabs)/index.tsx` - Rebuilt Home screen composing GreetingHeader + DailyThemeCard + discovery banner
- `ios/hooks/index.ts` - Added useDailyThemes to barrel export

## Decisions Made
- useDailyThemes sorts by dueCards descending (most urgent first), with updatedAt descending as tiebreaker -- aligns with Phase 15 daily rotation intent while using existing data
- Discovery banner restyled from opaque Card with accent border to GlassCard for Glass UI consistency
- Stats row uses middle-dot separator and plural handling for French text

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Home screen components ready for on-device testing via OTA update
- useDailyThemes hook has TODO marker for Phase 15 backend endpoint replacement
- Ready for Plan 02 (Explorer screen rebuild) and Plan 03 (Revisions + Profile)

## Self-Check: PASSED

All 6 files verified present. Both task commits (387b3fc, 31eb00d) verified in git log.

---
*Phase: 14-screen-rebuild*
*Completed: 2026-02-12*
