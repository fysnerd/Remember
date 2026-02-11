# Project Research Summary

**Project:** Ankora v3.0 - Night Blue Glass UI Design System
**Domain:** Visual design system migration for iOS learning app (Expo React Native)
**Researched:** 2026-02-11
**Confidence:** HIGH

## Executive Summary

Ankora v3.0 is a complete visual transformation of an existing Expo SDK 54 iOS learning app. The research reveals this is fundamentally a **design system replacement + screen restructure**, not an architectural rewrite. The core insight: one mandatory native rebuild upfront unlocks unlimited OTA iterations for all subsequent visual changes. The critical path is: install native dependencies (`expo-blur`, `react-native-svg`, `lucide-react-native`) → build → deploy visual changes via OTA.

The recommended approach layers a new design system (Night Blue palette, Glass UI components via `expo-blur`, Geist typography, Lucide icons) on top of the existing data layer (Zustand stores, React Query hooks, Axios API client) which remains largely unchanged. The current `theme.ts` flat-file token system is evolved into a directory structure with the same export surface, enabling automatic reskinning of existing components through token value replacement. Two lightweight backend endpoints (`/api/themes/daily` and `/api/themes/suggestions`) require no schema changes.

The key risk is attempting to ship visual changes via OTA before the native build is live. The dependency chain (`expo-blur` + `react-native-svg` required by `lucide-react-native`) forces a strict ordering: build first, then iterate. Secondary risks include React 19 peer dependency conflicts with Lucide, custom font integration breaking `fontWeight` references (Geist requires static weight files), and performance degradation from stacking multiple BlurViews in lists. All are preventable with Phase 1 validation and adherence to documented mitigation strategies.

## Key Findings

### Recommended Stack

The v3.0 stack additions are minimal and surgical. Three native dependencies enable the entire visual transformation: `expo-blur` for glass surfaces, `react-native-svg` as a peer dependency for Lucide icons, and `lucide-react-native` for the icon system. Geist typography via `@expo-google-fonts/geist` loads at runtime (OTA-compatible). No animation libraries are needed — the existing `react-native-reanimated` v4.1.1 covers all micro-interactions.

**Core technologies:**
- **expo-blur ~15.0.8**: Glass surface effects via native iOS `UIVisualEffectView` blur — the foundation of Glass UI, animatable intensity, requires native build
- **react-native-svg ~15.12.1**: SVG rendering engine required by Lucide icons — peer dependency, requires native build
- **lucide-react-native ^0.563.0**: 1500+ stroke-based SVG icons, tree-shakable, perfect for glass aesthetic — React 19 compatible as of v0.563.0, requires `--legacy-peer-deps` install
- **@expo-google-fonts/geist ^0.4.1**: Vercel's Geist Sans typeface (9 weights), geometric premium aesthetic — OTA-compatible via `useFonts` runtime loading
- **expo-linear-gradient ~15.0.7**: Gradient backgrounds for glass surface underlays — OTA-compatible if installed with blur in Phase 1 build

**Critical finding:** All three native modules are NOT currently installed. The first OTA update referencing `BlurView` or any Lucide icon will crash the current production binary. The project uses `runtimeVersion: { policy: "appVersion" }` which means native modules must be in the binary before OTA updates can reference them. A single upfront build (`eas build --profile production --platform ios --auto-submit`) is mandatory before any visual work ships.

### Expected Features

Research identified a clear split between table stakes (expected by users of premium dark-mode learning apps), competitive differentiators (what makes Ankora premium), and anti-features (explicit scope exclusions).

**Must have (table stakes):**
- **Night Blue semantic tokens** — every color hardcoded to light mode, full palette redesign required
- **Geist font integration** — System font is generic, Geist signals "premium tech product"
- **Lucide icon system** — emoji are inconsistent, unprofessional in dark UI, no color control
- **Glass card component** — reusable `GlassCard` with blur, the core visual primitive
- **Home: 3 daily themes** — focused daily learning vs. overwhelming full grid (smart rotation: due cards → new content → time since studied)
- **Explorer: Suggestions + Library** — AI-curated "what to study next" (8 suggestions) + full collection
- **Revisions: filter + search** — category chips + full-text search (table stakes for 50+ memos at scale)
- **Dark status bar and splash** — no white flash on launch, status bar text visible

**Should have (competitive differentiators):**
- **Visual freemium overlay** — blurred card + padlock icon, user sees content title but cannot access without upgrade (Duolingo pattern: 7+ paywall touchpoints, $25M/mo iOS revenue)
- **Daily theme rotation algorithm** — not random, scores by (1) due SR cards, (2) new unreviewed content, (3) time since studied
- **Micro-interactions** — haptic feedback on quiz answer, theme card tap, tab switch (premium feel, `expo-haptics` already installed)
- **Animated progress rings** — circular progress on daily theme cards (more engaging than flat bar)
- **Glass tab bar** — blur background that content scrolls behind (standard iOS pattern: Safari, Apple Music)
- **Staggered list animations** — content appears one-by-one with 50ms delay (polish, low cost)

**Defer (v2+):**
- **Light mode toggle** — doubles design surface area, ship dark-only first
- **Liquid Glass (iOS 26+)** — `expo-glass-effect` requires iOS 26+ unreleased, use `expo-blur` for iOS 16+ compatibility
- **Shared element transitions** — Reanimated 4 SET behind feature flag on New Architecture, known issues
- **Full recommendation ML** — smart SQL sorting is sufficient, no model hosting needed
- **Payment integration** — IAP/RevenueCat/Stripe are multi-day tasks, separate milestone
- **Android support** — `expo-blur` performance experimental on Android, iOS-only target

### Architecture Approach

The architecture is a **replacement layer**, not an addition. The current `theme.ts` (flat file with 6 token categories) becomes `theme/` directory (backward-compatible import path) with expanded tokens (Night Blue palette + glass + gradients). Existing components auto-reskin via token value changes; new Glass components (`GlassSurface`, `GlassCard`, `GlassButton`, `GlassTabBar`) compose on top. The data layer (stores, hooks, API client, backend routes) is untouched except for two new endpoints.

**Major components:**
1. **theme/tokens.ts** — all design tokens (colors, glass, typography, spacing, gradients, animation) replacing flat `theme.ts`, same export surface for backward compatibility
2. **GlassSurface** — foundational component managing `BlurView` + border + overflow, all Glass components compose on this (avoids duplicating blur config)
3. **Icon system** — `Icon.tsx` wraps Lucide with theme-aware defaults, `TabIcon.tsx` for tabs, `PlatformIcon.tsx` for sources (replaces all emoji usage)
4. **Screen restructure** — 4 tabs remain (Feed→Home, Library→Explorer, Memos→Revisions, Profile) but Home/Explorer/Revisions are full rewrites leveraging daily themes/suggestions endpoints
5. **Backend endpoints** — `GET /api/themes/daily` (3 smart-rotated themes) + `GET /api/themes/suggestions` (8 AI-suggested themes), both lightweight queries on existing models (no schema changes)

**Integration pattern:** Replace `theme.ts` → `theme/index.ts` (Metro auto-resolves), all 229 `import { colors } from '../../theme'` statements work unchanged. Components using `colors.surface` auto-reskin when `colors.surface` value changes from `#FAFAFA` to `#111827`. New Glass components use `glass` tokens added to same export.

### Critical Pitfalls

1. **Native dependency chain forces mandatory rebuild BEFORE visual changes ship** — `expo-blur` + `react-native-svg` + `lucide-react-native` are NOT in current binary. ANY OTA update referencing these will crash production. Install all three → `eas build --auto-submit` → THEN ship OTA updates. Switching to `runtimeVersion: { policy: "fingerprint" }` auto-detects native changes.

2. **Lucide-React-Native has React 19 peer dependency conflict + New Architecture risk** — peer deps declare `^16.5.1 || ^17.0.0 || ^18.0.0`, React 19 not listed. Project uses React 19.1.0 + `newArchEnabled: true`. Install with `npm install lucide-react-native --legacy-peer-deps`, immediately test in DEVELOPMENT BUILD (not Expo Go) on real device. Fallback: use `react-native-svg` directly with Lucide SVG path data.

3. **Custom font (Geist) + fontWeight = silent rendering failures** — React Native iOS ignores `fontWeight` with custom fonts, expects separate `.ttf` per weight. Current `Text.tsx` uses `fontFamily: 'System'` + `fontWeight: '700'` — this breaks with Geist. Must load static weight files (Geist-Regular.ttf, Geist-Medium.ttf, etc.) and reference as distinct `fontFamily` names. Restructure `fonts` export to `{ regular: 'Geist-Regular', bold: 'Geist-Bold' }`, remove ALL `fontWeight` usage across codebase.

4. **expo-blur BlurView + Reanimated animated props = broken on iOS** — animating `BlurView.intensity` with `useAnimatedProps` does not work (GitHub issues #32781, #23539, #6733). Use static `intensity` value, animate wrapper's opacity/translateY/scale instead. "Blur in" effect = animate wrapper opacity, not blur intensity.

5. **White flash of death on launch** — current `splash.backgroundColor: "#ffffff"`, app will show jarring white flash before dark UI renders. Update `app.json` splash to `#0a0f1a` + `userInterfaceStyle: "dark"` + create dark-compatible splash icon. This requires native build (bundle with dependency install in Phase 1).

**Additional high-severity pitfalls:**
- Stacking multiple BlurViews in lists destroys scroll performance — reserve real blur for static surfaces (tab bar, modals, 2-3 hero cards max), use faux-glass (semi-transparent bg + border) for list items
- Reanimated entry/exit layout animations cause memory leaks on list items — never use `entering`/`exiting` on FlatList children, reserve for one-time screens only
- 229 color references + 6 hardcoded hex + 17 rgba() values across 42 files — audit and tokenize ALL hardcoded colors BEFORE changing `theme.ts` values

## Implications for Roadmap

Based on research, suggested phase structure with strict dependency ordering:

### Phase 1: Foundation Build (CRITICAL FIRST)
**Rationale:** Native dependencies must be in binary before ANY visual changes ship. This is the unlock — one build enables unlimited OTA iterations for all subsequent phases.

**Delivers:**
- New production binary with `expo-blur`, `react-native-svg`, `lucide-react-native` installed
- Updated `app.json` (splash `#0a0f1a`, `userInterfaceStyle: "dark"`)
- Proof-of-concept validation (Lucide renders on New Architecture, blur works on device)
- No visual changes yet (users see same UI, just new binary)

**Critical validation:**
- Install all deps: `npx expo install expo-blur expo-linear-gradient react-native-svg && npm install lucide-react-native --legacy-peer-deps`
- Test Lucide rendering in `eas build --profile preview` on real device (not Expo Go)
- Verify BlurView renders, test static intensity values
- Ship: `eas build --profile production --platform ios --auto-submit`

**Avoids:**
- Pitfall 1 (OTA crash from missing native modules)
- Pitfall 2 (Lucide install failure + New Architecture risk)
- Pitfall 5 (white flash on launch)

**Duration:** 1-2 days including build time + TestFlight approval

### Phase 2: Design System Core (OTA-deployable)
**Rationale:** With native modules in binary, all design token and component work is OTA-compatible. Build foundation components before touching screens.

**Delivers:**
- `theme/tokens.ts` — Night Blue palette, glass tokens, Geist font references, animation timing
- Font loading in `app/_layout.tsx` via `useFonts` (Geist-Regular, Medium, SemiBold, Bold)
- `GlassSurface`, `GlassCard`, `GlassButton`, `GlassInput` components
- `Icon`, `TabIcon`, `PlatformIcon` Lucide wrappers
- Updated UI primitives (`Text.tsx` Geist fontFamily, `Button.tsx` glass variant, `Skeleton.tsx` dark colors)
- StatusBar light style

**Uses:** expo-blur (installed Phase 1), lucide-react-native (installed Phase 1), Geist fonts (OTA-compatible)

**Avoids:**
- Pitfall 3 (custom font fontWeight failures — use static weight files + fontFamily mapping)
- Pitfall 4 (BlurView animation broken — establish static intensity + wrapper animation pattern)
- Pitfall 12 (shadows invisible on dark — switch to border-based elevation)

**Deploy:** `eas update --branch production --message "Glass UI: design system core"`

**Duration:** 3-4 days

### Phase 3: Screen Architecture Rebuild (OTA-deployable)
**Rationale:** With design system components ready, rebuild screens leveraging new primitives. Tab restructure and screen rewrites are independent of backend.

**Delivers:**
- 4-tab structure with custom glass tab bar (Home/Explorer/Revisions/Profile)
- Home screen rewrite (3 daily theme cards, greeting, streak, stats)
- Explorer screen (Suggestions + Library dual tabs)
- Revisions screen rewrite (category filter chips, search, glass cards)
- Profile screen restyle (Night Blue, no dev tools in prod)

**Implements:**
- Screen restructure from ARCHITECTURE.md (Home daily themes, Explorer suggestions+library, Revisions filter+search)
- Table stakes features from FEATURES.md (semantic tokens, glass cards, Lucide icons, dark chrome)

**Avoids:**
- Pitfall 6 (229 color refs — audit and tokenize file-by-file with checklist)
- Pitfall 7 (multiple BlurViews in lists — faux-glass for ContentCard/ThemeCard list items, real blur for tab bar only)
- Pitfall 8 (tab restructure breaks routes — keep `(tabs)` dir name, update all hardcoded routes in `_layout.tsx`)
- Pitfall 11 (emoji icons — replace TabIcon in one pass, not incrementally)

**Deploy:** `eas update --branch production --message "Glass UI: screen architecture"`

**Duration:** 5-6 days

### Phase 4: Backend Integration (parallel track)
**Rationale:** Backend endpoints can be built in parallel with Phase 2-3, deployed independently to API, wired into screens at end of Phase 3.

**Delivers:**
- `GET /api/themes/daily` — 3 smart-rotated themes (scoring: due cards * 3 + new content * 2 + days since studied)
- `GET /api/themes/suggestions` — 8 AI-suggested themes (reuses existing theme classification logic, no ML model)
- `useDaily.ts` and `useSuggestions.ts` React Query hooks
- Wire hooks into Home and Explorer screens

**Implements:**
- Daily theme rotation algorithm (FEATURES.md competitive differentiator)
- AI suggestions endpoint (FEATURES.md table stakes)

**No schema changes:** Both endpoints query existing Theme + Card + Content models

**Deploy:** Backend SSH deploy: `ssh root@116.203.17.203 "cd /root/Remember/backend && git pull && npm run build && pm2 restart remember-api"`

**Duration:** 2-3 days (can overlap with Phase 2-3)

### Phase 5: Polish & Differentiators (OTA-deployable)
**Rationale:** With core screens live, layer on competitive differentiators and micro-interactions.

**Delivers:**
- Micro-interactions (haptic feedback on key actions, staggered list animations)
- Visual freemium (LockedOverlay component with blur + padlock icon, paywall screen with "Coming soon" CTA)
- Animated progress rings (SVG circle with Reanimated `useAnimatedProps` on daily theme cards)
- Glass modal sheets (bottom sheet with glass background for quiz start, settings)

**Implements:**
- Differentiators from FEATURES.md (visual freemium, haptics, progress rings, glass modals)

**Avoids:**
- Pitfall 9 (Reanimated memory leaks — no entering/exiting on list items, only on one-time screens)
- Pitfall 10 (StatusBar not updating — explicit `<StatusBar style="light" />` on modal screens)

**Deploy:** `eas update --branch production --message "Glass UI: polish and premium features"`

**Duration:** 3-4 days

### Phase Ordering Rationale

**Why Phase 1 is mandatory first:**
- Native dependency chain creates a hard gate — OTA updates referencing missing modules crash
- All visual work is blocked until new binary ships
- Proof-of-concept validation (Lucide on New Architecture, Geist static fonts, blur performance) de-risks entire project

**Why Phase 2 before Phase 3:**
- Components are building blocks, screens consume them
- Attempting screen migration without `GlassCard` and `Icon` components means building screens twice
- Token architecture must be finalized before touching 42 files with color references

**Why Phase 4 can run parallel:**
- Backend endpoints are independent of front-end components
- No data schema changes, just new routes
- Can deploy to API and stub with mock data until Phase 3 screens are ready

**Why Phase 5 last:**
- Polish and differentiators are additive, not foundational
- Freemium overlays require screens to exist first
- Micro-interactions should be added after base interactions work

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Requires hands-on proof-of-concept validation — install deps, build with `eas build --profile preview`, test Lucide rendering + blur on real device BEFORE committing to this stack. React 19 + New Architecture + Lucide is an untested combination.
- **Phase 5:** Visual freemium overlay pattern needs UX design research (lock icon placement, blur intensity for locked state, paywall copy and value props). Duolingo patterns provide baseline but need adaptation to learning app context.

Phases with standard patterns (skip research-phase):
- **Phase 2:** Design token architecture is well-documented (flat exports, TypeScript const objects, backward-compatible imports). Glass component composition follows established BlurView patterns from Expo docs.
- **Phase 3:** Screen restructure follows expo-router file-based routing patterns. Tab bar customization via `tabBar` prop is documented. No novel patterns.
- **Phase 4:** Backend endpoints are lightweight REST queries on existing Prisma models. Smart sorting SQL is standard database work.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All dependencies verified via Expo SDK 54 docs, npm package pages, and peer dependency analysis. Native module requirement confirmed by examining `package.json` (none installed). |
| Features | HIGH | Table stakes derived from competitive analysis (Duolingo, Notion, Spotify dark modes). Differentiators match established freemium patterns. Anti-features based on clear scope boundaries (iOS-only, no multi-theme, no light mode). |
| Architecture | HIGH | Based on direct codebase analysis (42 files importing theme, 8 UI components, 4 tab screens). Component boundaries, data flow, and integration points mapped from existing code. Backend endpoint design informed by current route structure and Prisma schema. |
| Pitfalls | HIGH | Critical pitfalls verified via GitHub issues (with issue numbers), Expo documentation warnings, and codebase analysis (hardcoded color count via grep, current splash config in app.json). React 19 + Lucide peer dep conflict confirmed via npm peer dependency declarations and GitHub issue #3185. |

**Overall confidence:** HIGH

Research is comprehensive with verified sources. The one medium-confidence area requiring hands-on validation is Lucide + React 19 + New Architecture combination — documented to work in isolation but not tested together on this specific project configuration. Phase 1 proof-of-concept build de-risks this.

### Gaps to Address

**Gap 1: Lucide-React-Native runtime behavior on New Architecture + React 19**
- **Issue:** Package is marked "Untested on New Architecture" and has React 19 peer dep conflict requiring `--legacy-peer-deps`
- **Mitigation:** Phase 1 must include proof-of-concept dev build (`eas build --profile preview`) testing Lucide icon rendering on real device. If icons fail, fallback is using `react-native-svg` directly with Lucide SVG path data (manual but guaranteed to work)

**Gap 2: Geist static font file availability**
- **Issue:** Research assumes static weight `.ttf` files exist for Geist Regular/Medium/SemiBold/Bold, but Geist is primarily distributed as variable font
- **Mitigation:** Verify Geist GitHub repo has static weight files (https://github.com/vercel/geist-font/tree/main/packages/next/dist/fonts/geist-sans). If not, generate from variable font using fonttools or find alternative font with similar aesthetic (Inter as fallback)

**Gap 3: BlurView performance on iOS with New Architecture**
- **Issue:** Most expo-blur documentation predates New Architecture (Fabric renderer). Performance characteristics may differ
- **Mitigation:** Phase 1 proof-of-concept must include scroll performance testing (Xcode Instruments) with 3 BlurViews on screen. If frame drops below 55fps on iPhone SE, reduce blur usage or lower intensity values

**Gap 4: Exact color values for Night Blue glass surfaces**
- **Issue:** Research provides semantic token structure but not final hex/rgba values for all tokens (229 color references need mapping)
- **Mitigation:** Phase 2 planning must include design audit — open each screen in dark mode, identify contrast issues, iterate on glass surface opacity/border values until WCAG AA compliance verified

**Gap 5: Daily theme rotation caching strategy**
- **Issue:** Research suggests 24h cache with midnight reset but does not specify implementation (in-memory, Redis, database)
- **Mitigation:** Phase 4 planning should decide: in-memory Map (simple, per-instance) vs. database cache table (persistent across restarts) vs. client-side cache (React Query 1h staleTime). In-memory Map recommended for MVP.

## Sources

### Primary (HIGH confidence)
- [Expo BlurView Documentation](https://docs.expo.dev/versions/latest/sdk/blur-view/) — props, platform support, animatable intensity, performance warnings
- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54) — compatible package versions, New Architecture status
- [Expo Fonts Documentation](https://docs.expo.dev/develop/user-interface/fonts/) — useFonts hook vs config plugin, static fonts requirement
- [Expo Color Themes Guide](https://docs.expo.dev/develop/user-interface/color-themes/) — dark mode, splash screen, StatusBar configuration
- [EAS Update Documentation](https://docs.expo.dev/eas-update/introduction/) — OTA scope (JS + assets only), native module limitations
- [Expo Runtime Versions](https://docs.expo.dev/eas-update/runtime-versions/) — appVersion vs fingerprint policy
- [Lucide React Native Guide](https://lucide.dev/guide/packages/lucide-react-native) — installation, peer dependencies, tree-shaking
- [@expo-google-fonts/geist on npm](https://www.npmjs.com/package/@expo-google-fonts/geist) — 9 weight variants, v0.4.1
- [React Native Reanimated Layout Animations](https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/entering-exiting-animations/) — entering/exiting API, 300ms default timing
- Direct codebase analysis: `ios/package.json`, `ios/app.json`, `ios/theme.ts`, 42 `.tsx` files importing theme, all UI components, tab screens, backend routes

### Secondary (MEDIUM confidence)
- [GitHub Issue #3185 - Lucide React 19 peer dep](https://github.com/lucide-icons/lucide/issues/3185) — React 19 incompatibility, merged fix July 2025
- [GitHub Issue #32781 - BlurView + Reanimated intensity broken](https://github.com/expo/expo/issues/32781) — animated intensity confirmed non-functional
- [GitHub Issue #27647 - expo-font fontWeight ignored](https://github.com/expo/expo/issues/27647) — custom font + fontWeight limitation
- [GitHub Issue #4322 - Reanimated entry/exit memory leak](https://github.com/software-mansion/react-native-reanimated/issues/4322) — layout animation memory issues
- [Dark Glassmorphism UI Patterns (Medium)](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f) — Glass UI best practices
- [Duolingo Freemium UX (AdPlist)](https://adplist.substack.com/p/how-duolingo-pushes-users-from-freemium) — 7+ paywall touchpoints, $25M/mo iOS revenue

### Tertiary (LOW confidence - needs validation)
- [Implementing Liquid Glass UI in React Native (Trifleck)](https://www.trifleck.com/blog/implementing-liquid-glass-ui-in-react-native-complete-guide-2026) — design token system patterns (published 2026, recent source)
- [React Native Reanimated Tutorial 2026 (Codes of Phoenix)](https://www.codesofphoenix.com/articles/expo/react-native-reanimated) — Reanimated v4 patterns with SDK 54 (recent but third-party tutorial)

---
*Research completed: 2026-02-11*
*Ready for roadmap: yes*
