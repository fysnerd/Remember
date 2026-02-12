# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** L'utilisateur apprend durablement a partir de ce qu'il consomme deja -- sans effort supplementaire de curation.
**Current focus:** v3.0 Night Blue Glass UI -- Phase 14: Screen Rebuild

## Current Position

Phase: 14 (Screen Rebuild) -- IN PROGRESS
Plan: 2 of 3 in current phase
Status: Completed 14-02 (Explorer screen rebuild), continuing with 14-03
Last activity: 2026-02-12 -- Completed 14-02 (Explorer screen rebuild)

Progress: [#######░░░] 7/11 plans (v3.0)

## Performance Metrics

**Velocity:**
- Total plans completed: 29 (10 v1.0 + 12 v2.0 + 7 v3.0)
- v1.0: ~25 min/plan avg (4 phases, 10 plans)
- v2.0: ~3.75 min/plan avg (7 phases, 12 plans)
- v3.0: 10.3 min/plan avg (3 phases, 7 plans)
- Total execution time: ~6 hours 2 min across all milestones

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 12-01 | Foundation deps + dark mode | 7 min | 3 | 9 |
| 12-02 | Build validation + TestFlight | 35 min | 3 | 0 (build-only) |
| 13-01 | Night Blue tokens + UI restyle | 3 min | 2 | 8 |
| 13-02 | Glass components + glass tab bar | 4 min | 2 | 11 |
| 13-03 | Lucide icon system + emoji elimination | 19 min | 2 | 25 |
| 14-01 | Home screen rebuild (greeting + daily themes) | 2 min | 2 | 5 |
| 14-02 | Explorer screen rebuild (search + two-level tabs) | 2 min | 2 | 7 |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v3.0 roadmap]: Native rebuild (Phase 12) mandatory before any OTA visual work
- [v3.0 roadmap]: Backend endpoints (Phase 15) independent -- can run parallel with frontend phases
- [v3.0 roadmap]: BlurView intensity not animatable -- use opacity wrappers instead
- [12-01]: fontFamily not fontWeight for Geist -- RN ignores fontWeight on custom fonts
- [12-01]: SplashScreen gating: preventAutoHideAsync in module scope, hideAsync on fontsLoaded AND auth
- [12-02]: BlurView renders on New Arch but no visible frost at intensity=40 -- tune in Phase 13
- [12-02]: Ad Hoc provisioning broken (push notification entitlement) -- use TestFlight for validation
- [13-01]: colors.accent (Soft Gold) for synthesis badge instead of Indigo -- palette consistency
- [13-01]: Button borderRadius upgraded from sm to md for modern appearance
- [13-02]: overflow:hidden on parent View to clip BlurView (BlurView ignores borderRadius directly)
- [13-02]: GlassCard composes GlassSurface rather than duplicating blur logic
- [13-02]: Tab bar absolute positioning -- screens need paddingBottom (deferred to 13-03/14)
- [13-03]: PlatformIcon uses generic Lucide concept icons (Play, Headphones, Music, Camera) -- no brand icons in Lucide
- [13-03]: EmptyState accepts LucideIcon prop instead of emoji string -- breaking but cleaner pattern
- [13-03]: useBottomTabBarHeight added to all tab screens for absolute tab bar padding
- [14-01]: useDailyThemes sorts by dueCards desc with updatedAt tiebreaker as Phase 15 stub
- [14-01]: Discovery banner restyled with GlassCard instead of opaque Card with accent border
- [14-01]: Home screen components extracted to ios/components/home/ directory
- [14-02]: Top-level tab indicator uses colors.accent (Soft Gold) for visual hierarchy
- [14-02]: Sub-tabs use variant=caption for lighter visual weight than top-level tabs
- [14-02]: SearchInput is custom BlurView+TextInput (not GlassInput) to support left icon layout
- [14-02]: Default activeExplorerTab is 'library' since suggestions are placeholder until Phase 15

### Pending Todos

None.

### Blockers/Concerns

- ~~Lucide + React 19 + New Architecture is untested combination~~ RESOLVED: renders on-device
- ~~Geist static weight .ttf availability needs verification~~ RESOLVED: @expo-google-fonts/geist provides static weights
- ~~BlurView performance on New Architecture (Fabric) undocumented~~ RESOLVED: renders without crash, but frost effect not visible at intensity=40 -- needs tuning in Phase 13
- ~~Pre-existing Button.tsx missing `style` prop in type definition (5 TS errors in theme/manage, topic/manage, TopicEditModal)~~ RESOLVED: Fixed in 13-01

## Session Continuity

Last session: 2026-02-12
Stopped at: Completed 14-02-PLAN.md (Explorer screen rebuild)
Next step: Execute 14-03-PLAN.md (remaining screen rebuilds)
Resume file: None
