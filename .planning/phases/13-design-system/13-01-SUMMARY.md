---
phase: 13-design-system
plan: 01
subsystem: ui
tags: [react-native, design-tokens, glass-ui, night-blue, dark-mode, theme]

requires:
  - phase: 12-foundation-build
    provides: "Geist fonts, expo-blur, lucide-react-native, Night Blue color palette in theme.ts"
provides:
  - "Glass design tokens (border, fill, shadow, intensity, tint) in theme.ts"
  - "Button style prop fix (resolves 5 pre-existing TS errors)"
  - "8 UI primitives restyled for Night Blue consistency"
  - "QuestionCard converted from light-mode hex to dark-mode tokens"
affects: [13-02-glass-components, 13-03-icon-system, 14-screen-rebuild]

tech-stack:
  added: []
  patterns:
    - "Glass token object in theme.ts for blur/border/shadow defaults"
    - "getOptionStyle helper for dynamic quiz option theming"
    - "StyleSheet.create for performance over inline styles"

key-files:
  created: []
  modified:
    - "ios/theme.ts"
    - "ios/components/ui/Button.tsx"
    - "ios/components/ui/Card.tsx"
    - "ios/components/ui/Input.tsx"
    - "ios/components/ui/TopicChip.tsx"
    - "ios/components/ui/Skeleton.tsx"
    - "ios/components/ui/Toast.tsx"
    - "ios/components/quiz/QuestionCard.tsx"

key-decisions:
  - "Used colors.accent (Soft Gold) for synthesis badge instead of #6366F1 (Indigo) for palette consistency"
  - "Used colors.background (dark) for synthesis badge text instead of white for proper Night Blue contrast"
  - "Upgraded Button borderRadius from sm (6) to md (10) for modern appearance"

patterns-established:
  - "getOptionStyle pattern: helper function for conditional color logic on quiz options"
  - "Glass tokens pattern: all blur/glass defaults in glass export object for consistent usage"

duration: 3min
completed: 2026-02-11
---

# Phase 13 Plan 01: Night Blue Token Foundation Summary

**Glass design tokens added to theme.ts, Button style prop fixed, 8 UI primitives restyled, QuestionCard 10 hardcoded light-mode colors converted to Night Blue tokens**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-11T17:04:42Z
- **Completed:** 2026-02-11T17:08:06Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added `glass` export to theme.ts with border, fill, shadow, intensity, and tint tokens for upcoming Glass components
- Fixed Button.tsx missing `style` prop TypeScript bug (resolves 5 pre-existing errors across theme/manage, topic/manage, TopicEditModal)
- Converted QuestionCard from 10 hardcoded light-mode hex values (#DCFCE7, #FEE2E2, etc.) to Night Blue theme tokens
- Restyled 7 UI primitives: Button (borderRadius + secondary border), Card (border), Input (Geist font), TopicChip (border states), Skeleton (elevated surface color), Toast (borderRadius + glass border)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add glass tokens to theme.ts and restyle UI primitives** - `d7a526b` (feat)
2. **Task 2: Convert QuestionCard hardcoded light-mode colors to Night Blue tokens** - `0fa57b3` (feat)

## Files Created/Modified
- `ios/theme.ts` - Added glass design tokens (border, fill, shadow, intensity, tint)
- `ios/components/ui/Button.tsx` - Added style prop, upgraded borderRadius, added secondary border
- `ios/components/ui/Card.tsx` - Added subtle border for depth on dark backgrounds
- `ios/components/ui/Input.tsx` - Added Geist fontFamily for consistent typography
- `ios/components/ui/TopicChip.tsx` - Added border states for selected/unselected visibility
- `ios/components/ui/Skeleton.tsx` - Changed pulse color from border to surfaceElevated
- `ios/components/ui/Toast.tsx` - Upgraded borderRadius to md, added glass border
- `ios/components/quiz/QuestionCard.tsx` - Replaced all 10 hardcoded hex colors with theme tokens, extracted styles to StyleSheet

## Decisions Made
- Used `colors.accent` (Soft Gold D4A574) for synthesis badge instead of `#6366F1` (Indigo) -- maintains Night Blue palette consistency
- Used `colors.background` for synthesis badge text (dark on gold) instead of `#FFFFFF` -- better contrast with warm gold
- Upgraded Button `borderRadius` from `sm` (6px) to `md` (10px) -- more modern rounded appearance
- Used `!!` coercion on `isWrong` in QuestionCard to resolve TS type narrowing issue with optional `correctId`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type narrowing in QuestionCard getOptionStyle**
- **Found during:** Task 2 (QuestionCard conversion)
- **Issue:** `isWrong` computed as `correctId && isSelected && !isCorrect` produced type `string | false | undefined` which was incompatible with `boolean` parameter
- **Fix:** Added `!!` coercion to produce clean boolean: `!!(correctId && isSelected && !isCorrect)`
- **Files modified:** ios/components/quiz/QuestionCard.tsx
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** `0fa57b3` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Minimal -- standard TypeScript type narrowing fix required by extracting inline logic to typed helper function.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Glass tokens are ready for GlassSurface, GlassCard, GlassButton, GlassInput components (Plan 13-02)
- All 8 UI primitives use Night Blue tokens consistently -- ready for icon replacement (Plan 13-03)
- Button style prop fix unblocks any component passing style to Button
- QuestionCard dark-mode conversion ensures quiz UI renders correctly on dark backgrounds
- Pre-existing blocker "Button.tsx missing style prop" is now RESOLVED

## Self-Check: PASSED

- All 9 files verified present on disk
- Commit `d7a526b` (Task 1) found in git log
- Commit `0fa57b3` (Task 2) found in git log
- `npx tsc --noEmit` passes with zero errors
- Zero hardcoded light-mode hex values remain in QuestionCard

---
*Phase: 13-design-system*
*Completed: 2026-02-11*
