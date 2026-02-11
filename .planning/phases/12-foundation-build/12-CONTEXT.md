# Phase 12: Foundation Build - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Install native dependencies (expo-blur, react-native-svg, lucide-react-native), activate Night Blue dark mode base across the entire app, load Geist font app-wide, validate key technologies on-device, and ship a new production binary to TestFlight. No design system, no screen rebuilds, no new features.

</domain>

<decisions>
## Implementation Decisions

### Dark mode scope
- Night Blue (#0a0f1a) applied to ALL existing screens, not just root
- Light status bar (white text/icons) forced globally
- White flash prevention on launch (Claude's discretion on approach — splash + backgroundColor in app.json)

### Font provisioning
- Static .ttf weights (not variable font)
- Geist Sans only (no Geist Mono)
- Replace current font app-wide immediately — Geist becomes the default font in this phase
- Claude's discretion on exact weights to bundle (minimum: Regular, Medium, SemiBold, Bold)

### Validation approach
- Visual confirmation only — no FPS benchmarks (performance tuning in Phase 16)
- Claude's discretion on validation method (test screen vs inline)
- Lucide icon fallback: SF Symbols / expo-symbols if Lucide fails on New Architecture + React 19

### Build & rollout
- Preview build first to validate on-device, then production build
- Production build with --auto-submit to TestFlight
- Continue incrementing from current build number (around 8)
- Bump app version to next minor (1.0.x range — milestone v3.0 is internal, not App Store version)

### Claude's Discretion
- White flash prevention implementation details
- Exact Geist font weights to bundle (4 minimum, more if useful for the design)
- Validation strategy (temporary test screen vs modifying existing screens)
- BlurView fallback if performance issues on New Architecture (evaluate tradeoff between glass vision and perf)
- Quick readability pass on existing screens (white text, light borders) vs leaving broken-looking until Phase 13

</decisions>

<specifics>
## Specific Ideas

- Everything goes dark NOW — user wants to see Night Blue across the app immediately, even if screens look rough before Phase 13
- Geist replaces current font globally in this phase, not just for validation
- SF Symbols is the preferred fallback over react-native-vector-icons if Lucide doesn't work

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-foundation-build*
*Context gathered: 2026-02-11*
