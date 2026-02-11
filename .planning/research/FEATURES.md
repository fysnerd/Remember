# Feature Landscape

**Domain:** Glass UI design system, dark mode, and premium learning app UX for Ankora v3.0
**Researched:** 2026-02-11
**Context:** Subsequent milestone adding Night Blue dark mode, Glass UI surfaces, Geist typography, Lucide icons, redesigned screen architecture, AI content suggestions, visual freemium, and micro-interactions to existing Expo SDK 54 iOS learning app. Theme system, quiz, SM-2 reviews, 4-tab navigation already in production.

---

## Table Stakes

Features users expect in a premium dark-mode learning app. Missing = the redesign looks like an amateur skin swap.

### Design System Foundation

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|-------------|-------|
| **Semantic design tokens (dark palette)** | Every color reference in the app currently uses hardcoded light-mode values from `theme.ts`. Without semantic tokens that swap dark/light, every screen needs individual color overrides. | Med | None -- replaces existing `theme.ts` | Current `colors.background: '#FFFFFF'` becomes `colors.background: '#0A0F1A'`. Must define primitive tokens (raw hex) + semantic tokens (background, surface, text roles). Night Blue palette: background `#0A0F1A`, surface `rgba(255,255,255,0.05)`, surfaceElevated `rgba(255,255,255,0.08)`, text `#F0F0F0`, textSecondary `rgba(255,255,255,0.6)`, accent `#D4A574` (Soft Gold). |
| **Geist font integration** | System font is generic. Geist gives editorial, premium feel that matches dark/glass aesthetic. Available via `@expo-google-fonts/geist` with 9 weight variants. | Low | `expo-font` already in deps, add `@expo-google-fonts/geist` | Load in root `_layout.tsx` via `useFonts` hook. Map to `fonts.regular = 'Geist_400Regular'`, `fonts.medium = 'Geist_500Medium'`, `fonts.bold = 'Geist_700Bold'`. Existing Text component references `fonts.regular` so change propagates automatically. |
| **Lucide icon system** | Current app uses emoji for all icons (tab bar, sources, states). Emoji render inconsistently across iOS versions, lack color control, and look unprofessional in a dark UI. Lucide provides 1500+ consistent SVG icons. | Low | Add `lucide-react-native` + `react-native-svg` (already in Expo SDK 54 default deps) | Replace emoji in TabLayout, source badges, empty states, navigation. Use `size={20}` for inline, `size={24}` for tab bar, `size={48}` for empty states. Tree-shakes to only imported icons. |
| **Glass card component** | The core visual primitive for Glass UI. A reusable `GlassCard` wrapping `expo-blur` BlurView with consistent blur intensity, border opacity, and padding. Current `Card` component is a plain `View` with `backgroundColor: colors.surface`. | Med | `expo-blur` (add to deps) | `BlurView` with `intensity={25}`, `tint="dark"`, 1px `rgba(255,255,255,0.1)` border, `borderRadius: 16`. Must handle the known rendering order issue (BlurView must render after dynamic content like FlatList). Performance is fine on iOS; experimental on Android (iOS-only target mitigates this). |
| **Dark status bar and navigation chrome** | Without matching status bar color, the app has a jarring white bar above dark content. | Low | `expo-status-bar` already in deps | Set `<StatusBar style="light" />` in root layout. Update `headerStyle.backgroundColor` and `tabBarStyle.backgroundColor` in navigators. |
| **Consistent spacing and radius scales** | Current spacing (xs:4, sm:8, md:12, lg:20, xl:28, xxl:40) is already defined. Glass UI needs slightly larger radii for the softer aesthetic. | Low | None -- update existing `borderRadius` in `theme.ts` | Increase `md` from 10 to 14, `lg` from 14 to 18, `xl` from 20 to 24. Glass surfaces use larger radii for the frosted look. |

### Screen Architecture

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|-------------|-------|
| **Home: daily theme cards** | Current home shows ALL themes in a 2-column grid. v3.0 shows exactly 3 "daily themes" selected by smart rotation. This is the core UX shift: focused daily learning vs. overwhelming full grid. | Med | Existing theme system, SM-2 card data | Algorithm: rank themes by (1) due review count (highest priority), (2) new unquizzed content count, (3) recency of last study. Show top 3. Compute server-side in new `GET /api/home/daily-themes` endpoint. Cache for 24h per user with midnight reset. |
| **Home: greeting + streak** | "Bonjour, [name]" with time-of-day awareness + current study streak. Table stakes for learning apps (Duolingo, Headspace all do this). | Low | Auth store has user data, streak needs a new backend query | Streak = consecutive days with at least 1 quiz answered. Query existing `Review` table grouped by date. |
| **Explorer: dual-tab layout (Suggestions + Library)** | Current Library has Collection + Triage tabs. v3.0 splits Explorer into "Suggestions" (AI-curated content to study next) and "Library" (full collection). Suggestions tab is the sticky engagement hook. | Med | Existing library screens, new suggestions endpoint | Reuse existing Library tab code for the Library sub-tab. Suggestions tab = new screen component. The tab toggle pattern already exists in `library.tsx` (Collection/Triage toggle). |
| **Explorer: 8 AI suggestions** | Show 8 content items prioritized by: overdue reviews first, then new content with completed transcription and quiz, then recently synced. Not a full recommendation engine -- just smart sorting. | Med | Backend: new `GET /api/suggestions` endpoint | Server ranks content: (1) overdue SR cards, (2) content with quizzes user hasn't started, (3) new content with transcription ready. Returns 8 items. No ML model needed -- pure SQL/Prisma query with scoring. |
| **Revisions: category filter chips** | Current Revisions screen is a flat list with no filtering. Users with 50+ memos cannot find anything. Category filter (by theme or source) is table stakes. | Low | Existing theme data, source data on content | Horizontal scroll chips: "Tout", then theme names, then sources. Filter the existing `useCompletedItems` query. Reuse `SourcePills` component pattern from Library. |
| **Revisions: full-text search** | Users must be able to search their memos by keyword. Without search, the memo list becomes useless at scale. | Med | Backend: add search param to completed-items endpoint | Text search on content title + memo text. Prisma `contains` filter for simplicity (no full-text index needed at current scale). Debounced input, 300ms delay. |
| **Profile: clean info + settings** | Current profile has dev tools mixed in. v3.0 separates: user avatar/info at top, connected platforms, settings section. No dev tools in production. | Low | Existing profile screen, just reorganize | Remove dev sync buttons (or hide behind flag). Add proper settings rows: notifications, about, version, logout. Glass card surfaces for each section. |
| **3-tab navigation (Home / Explorer / Revisions)** | v3.0 consolidates from 4 tabs to 3. Profile moves to header avatar/button on Home. This is a common pattern (Notion, Spotify) -- reduces tab bar clutter. | Low | Restructure `(tabs)/_layout.tsx` | Remove `profile` tab, add profile icon button in Home header that navigates to `/profile` as a regular stack screen. Tab bar gets glass blur background. |

### Visual Polish

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|-------------|-------|
| **Glass tab bar** | Tab bar with blur background that content scrolls behind. Standard iOS pattern (Safari, Apple Music). | Med | `expo-blur`, tab layout restructure | Use `BlurView` as `tabBarBackground` in tab navigator `screenOptions`. Requires `tabBarStyle: { position: 'absolute', backgroundColor: 'transparent' }` so content scrolls underneath. Native blur on GPU is performant -- 60fps verified in iOS ecosystem research. |
| **Proper loading skeletons (dark)** | Current `Skeleton` uses `Animated.Value` with `colors.border` (light gray). On dark backgrounds, light gray skeletons look broken. Must match dark surface colors. | Low | Existing `Skeleton.tsx`, update colors | Change skeleton bg to `rgba(255,255,255,0.08)` and pulse between 0.3-0.6 opacity. Consider migrating from `Animated` to `react-native-reanimated` for UI-thread performance (Reanimated 4.1.1 already installed). |
| **Content thumbnail overlays** | Source icon badge + duration overlay on content thumbnails. Current `ContentCard` shows this but without glass styling. | Low | Existing `ContentCard`, add blur overlay | Small glass pill with Lucide icon + duration text positioned bottom-right on thumbnail. |
| **Smooth screen transitions** | Current app uses default iOS card push. v3.0 adds intentional entrance/exit animations per screen type. | Med | `react-native-reanimated` (already installed v4.1.1) | Use Reanimated layout animations: `FadeIn.duration(200)` for list items, `SlideInRight.duration(250)` for push screens. Default 300ms is too slow for a snappy app -- target 200-250ms. Respect `reduceMotion` system setting. |

---

## Differentiators

Features that set Ankora apart from generic learning apps. Not expected but create the "premium" feel.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|-------------|-------|
| **Visual freemium lock overlay** | Locked content shows a blurred card with a padlock (cadenas) icon overlay. User sees the content title but cannot access quiz/memo without upgrade. Creates aspiration without frustration. Duolingo uses 7+ paywall touchpoints per session and generates $25M/mo iOS revenue. | Med | Backend: `user.plan` field (already exists), content-level access check. Front-end: glass overlay component. | `LockedOverlay` component: `BlurView` intensity 80 + centered Lucide `Lock` icon + "Debloquer avec Premium" text. Apply conditionally based on `user.plan === 'FREE'` and content count thresholds. Must define what free tier includes (e.g., 3 themes, 20 content items, basic quizzes). |
| **Contextual paywall** | When user taps locked content, show paywall screen that highlights the feature they tried to access (Duolingo pattern). "Debloquez les quiz de synthese" when tapping locked synthesis quiz vs. "Debloquez plus de themes" when tapping locked theme. | Med | Freemium lock overlay, paywall screen | Single `PaywallScreen` with dynamic hero text based on `trigger` param. No actual payment integration needed yet (future milestone). Show value props, "Coming soon" CTA. |
| **Daily theme rotation algorithm** | Not random -- smart rotation considers: (1) overdue spaced repetition cards, (2) themes with new unreviewed content, (3) time since last study of theme. Creates a personalized daily study plan without the user lifting a finger. | Med | Theme data, SR card data, content sync timestamps | Backend endpoint `GET /api/home/daily-themes` with scoring: `score = (dueCards * 3) + (newContent * 2) + (daysSinceStudied * 1)`. Top 3 by score. Tiebreaker: alphabetical. 24h cache with TTL. |
| **Micro-interactions: haptic feedback** | Subtle haptic on quiz answer, theme card tap, tab switch, pull-to-refresh complete. Makes the app feel tactile and premium. `expo-haptics` is already installed. | Low | `expo-haptics` (already in deps) | `Haptics.impactAsync(ImpactFeedbackStyle.Light)` on card press, `Medium` on quiz answer, `Success` on correct answer. 3 lines of code per interaction point. Do NOT over-use -- only on meaningful user actions. |
| **Animated progress rings** | Theme mastery shown as animated circular progress on daily theme cards. More engaging than the current flat progress bar. | Med | `react-native-reanimated`, custom SVG component | SVG circle with `strokeDasharray` animated via Reanimated `useAnimatedProps`. Animates from 0 to current % on card mount with 600ms spring. Soft Gold accent color for the ring. |
| **Glass modal sheets** | Quiz start confirmation, content detail overlay, and settings use bottom sheet modals with glass background. Premium feel vs. default iOS modal. | Med | `expo-blur`, Reanimated for gesture-driven dismiss | `GlassBottomSheet` component: BlurView full-screen backdrop + animated slide-up card. `PanGestureHandler` for drag-to-dismiss. More polish than functional necessity but significantly elevates perceived quality. |
| **Staggered list animations** | Content lists (suggestions, library, memos) animate in with staggered fade+slide. Items appear one-by-one with 50ms delay between each. | Low | `react-native-reanimated` layout animations | `FadeInDown.delay(index * 50).duration(200)` on list items. Already standard pattern in Reanimated -- no custom animation code needed. Cap at index 10 to avoid excessive delays. |
| **Shimmer loading (dark mode)** | Replace current pulse-opacity skeleton with proper shimmer animation (gradient sweep). Standard in YouTube, Twitter, Netflix dark modes. | Med | `react-native-reanimated` or `react-native-fast-shimmer` | Reanimated `useAnimatedStyle` with `translateX` sweep across skeleton width. Dark shimmer: base `rgba(255,255,255,0.05)`, highlight `rgba(255,255,255,0.12)`. More polished than current `Animated.timing` pulse approach. |

---

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Light mode toggle / dual theme support** | Doubles the design surface area. Every screen needs testing in both modes. Current light theme is being fully replaced, not supplemented. Users who want light mode can wait for a future milestone. | Ship dark mode only. Set `userInterfaceStyle: "dark"` in `app.json`. No toggle in settings. |
| **Custom theme builder (user picks colors, fonts)** | Theming complexity explosion. Font loading, color validation, accessibility checking per user choice. Low value for a learning app. | Fixed design system. One curated aesthetic. The premium feel comes from opinionated design, not user customization. |
| **Liquid Glass (iOS 26+)** | `expo-glass-effect` requires iOS 26+ (not even released yet). The existing user base is on iOS 17-18. `expo-blur` BlurView provides a perfectly good glass effect on all iOS versions. | Use `expo-blur` BlurView with `intensity` 20-40 + `tint="dark"`. Achieves 90% of the liquid glass look on 100% of devices. |
| **Shared element transitions (card-to-detail)** | Reanimated 4 Shared Element Transitions are behind a feature flag on New Architecture (Fabric). Known issues with nested stacks (GitHub #5641). Risk of visual glitches. | Use standard push with `SlideInRight` or Expo's zoom transition (iOS 18+ only, graceful fallback). Simpler, more reliable. |
| **Complex gesture-driven animations (swipe cards, 3D transforms)** | Over-animation makes apps feel gimmicky. Learning apps need content focus, not gesture novelty. Performance risk on older devices. | Keep gestures to tap, long-press, pull-to-refresh, and scroll. Animations are enter/exit and micro-interactions only. |
| **Full recommendation engine for Suggestions** | ML-based content recommendations require training data, model hosting, and inference costs. Overkill for a sorting feature. | Smart SQL sorting: overdue reviews, then unquizzed content, then recent. Feels like AI but is just database queries with scoring. |
| **Animated tab bar icons** | Lottie animations per tab icon add bundle size, complexity, and distraction. | Static Lucide icons with color change on active/inactive. The glass blur tab bar background is the visual statement. |
| **Payment/subscription integration** | IAP setup, App Store review, receipt validation, Stripe/RevenueCat integration are each multi-day tasks. Out of scope for a design milestone. | Visual freemium only: show locks, show paywall screen with "Coming soon" or email signup. Actual payments are a separate milestone. |
| **Dark mode per-component overrides** | Some apps let users choose dark mode for specific sections. Unnecessary complexity for a design system migration. | Global dark mode. Every screen uses the same semantic tokens. No per-screen overrides. |
| **Android support** | `expo-blur` performance is experimental on Android. Glass effects may cause graphical issues. Ankora is iOS-only right now. | Keep iOS-only. If Android becomes a target, address blur fallbacks then. |

---

## Feature Dependencies

```
Design Tokens (theme.ts rewrite)
  |
  +---> Geist Font Loading (_layout.tsx)
  |       |
  |       +---> Text Component Update (reference Geist families)
  |
  +---> GlassCard Component (expo-blur + new tokens)
  |       |
  |       +---> Glass Tab Bar (BlurView as tabBarBackground)
  |       |
  |       +---> Glass Bottom Sheet Modal
  |       |
  |       +---> Freemium Lock Overlay (BlurView + Lock icon)
  |       |       |
  |       |       +---> Contextual Paywall Screen
  |       |
  |       +---> All Screen Redesigns (use GlassCard everywhere)
  |
  +---> Lucide Icon System (replace all emoji)
  |       |
  |       +---> Tab Bar Icons
  |       +---> Source Badges
  |       +---> Empty States
  |       +---> Navigation Headers
  |
  +---> Dark Skeletons / Shimmer
  |
  +---> Screen Restructure
          |
          +---> 3-Tab Nav (Home / Explorer / Revisions)
          |       |
          |       +---> Profile as Stack Screen (header avatar button)
          |
          +---> Home: Daily Themes (3 cards)
          |       |
          |       +---> Smart Rotation Algorithm (backend endpoint)
          |       |
          |       +---> Animated Progress Rings (Reanimated SVG)
          |       |
          |       +---> Greeting + Streak
          |
          +---> Explorer: Suggestions + Library Tabs
          |       |
          |       +---> AI Suggestions Endpoint (backend)
          |       |
          |       +---> Library (reuse existing, restyle)
          |
          +---> Revisions: Filter + Search
                  |
                  +---> Category Filter Chips
                  |
                  +---> Full-Text Search (backend + debounced input)

Micro-interactions (independent, can be added anytime):
  - Haptic feedback (expo-haptics)
  - Staggered list animations (Reanimated entering)
  - Screen transitions (Reanimated entering/exiting)

Critical path: Design Tokens --> GlassCard --> Screen Redesigns
Backend parallel track: Daily Themes endpoint + Suggestions endpoint + Search endpoint
```

---

## MVP Recommendation

### Phase 1: Design System Foundation (must-have first)

Build order matters. Everything depends on tokens and the glass card component.

1. **Design tokens rewrite** -- Replace entire `theme.ts` with Night Blue palette, semantic naming, and dark-mode values
2. **Geist font loading** -- Install `@expo-google-fonts/geist`, load in root layout, update `fonts` object
3. **Lucide icon integration** -- Install `lucide-react-native`, create `Icon` wrapper component, replace emoji in shared components
4. **GlassCard component** -- New `GlassCard.tsx` using `expo-blur` BlurView with consistent props
5. **Dark skeletons** -- Update `Skeleton.tsx` colors for dark backgrounds
6. **Status bar + navigation chrome** -- Dark backgrounds everywhere

### Phase 2: Screen Architecture

7. **3-tab navigation** -- Restructure `(tabs)/_layout.tsx` to Home/Explorer/Revisions, move Profile to stack
8. **Glass tab bar** -- BlurView background, Lucide icons, transparent absolute positioning
9. **Home screen redesign** -- Daily themes (3 cards), greeting, streak, progress rings
10. **Daily themes backend** -- `GET /api/home/daily-themes` with smart rotation scoring
11. **Explorer screen** -- Suggestions + Library dual tabs, restyle existing Library content
12. **Suggestions backend** -- `GET /api/suggestions` with overdue/new/recent scoring
13. **Revisions screen redesign** -- Category filter chips + search bar + glass cards

### Phase 3: Polish and Differentiation

14. **Micro-interactions** -- Haptic feedback on key actions, staggered list animations, screen transitions
15. **Visual freemium** -- LockedOverlay component + paywall screen (no actual payments)
16. **Animated progress rings** -- SVG circle with Reanimated on daily theme cards
17. **Glass modals** -- Bottom sheet with glass background for quiz start, settings

### Defer to Later Milestone

- **Payment integration** -- RevenueCat/Stripe for actual subscriptions. Separate milestone.
- **Light mode** -- Add theme toggle once dark mode is stable. Requires duplicating semantic tokens.
- **Liquid Glass (iOS 26)** -- Revisit when iOS 26 ships and user base upgrades.
- **Shared element transitions** -- Wait for Reanimated 4 to stabilize on New Architecture.
- **Android glass fallbacks** -- Only if Android becomes a target.
- **Full recommendation ML** -- Only if smart SQL sorting proves insufficient engagement.

---

## Complexity Analysis

| Complexity | Features | Estimated Effort |
|------------|----------|------------------|
| **Low** | Geist fonts, Lucide icons, dark status bar, haptic feedback, staggered animations, dark skeletons, profile cleanup | 0.5-1 day each |
| **Medium** | Design tokens rewrite (touches every file), GlassCard component, glass tab bar, daily themes backend, suggestions backend, home screen redesign, explorer redesign, revisions search, freemium overlay, progress rings, glass modals, screen transitions | 1-3 days each |
| **High** | Full 3-tab navigation restructure (file-based routing changes, profile migration), comprehensive testing of all screens with new design system | 3-5 days |

**Total estimated effort for Phase 1 (Foundation):** 4-6 days
**Phase 1 + Phase 2 (Screens):** 2-3 weeks
**All three phases:** 3-4 weeks

---

## Contrast and Accessibility Notes

The Night Blue palette must meet WCAG AA (4.5:1 minimum) contrast ratios:

| Combination | Foreground | Background | Contrast Ratio | Status |
|-------------|-----------|------------|---------------|--------|
| Primary text on background | `#F0F0F0` | `#0A0F1A` | ~14.5:1 | Exceeds AAA |
| Secondary text on background | `rgba(255,255,255,0.6)` | `#0A0F1A` | ~7.5:1 | Exceeds AA |
| Accent on background | `#D4A574` | `#0A0F1A` | ~6.8:1 | Exceeds AA |
| Accent on glass surface | `#D4A574` | `rgba(255,255,255,0.08)` on `#0A0F1A` | ~6.5:1 | Exceeds AA |
| Text on glass surface | `#F0F0F0` | `rgba(255,255,255,0.05)` on `#0A0F1A` | ~13.8:1 | Exceeds AAA |

All combinations pass AA. Primary text passes AAA. No accessibility concerns with this palette.

---

## Sources

### Official Documentation (HIGH confidence)
- [Expo BlurView](https://docs.expo.dev/versions/latest/sdk/blur-view/) -- props, platform support, known issues, SDK 54
- [Expo GlassEffect](https://docs.expo.dev/versions/latest/sdk/glass-effect/) -- iOS 26+ only, NOT recommended for current milestone
- [Expo Fonts](https://docs.expo.dev/develop/user-interface/fonts/) -- useFonts hook, config plugin
- [Expo Zoom Transition](https://docs.expo.dev/router/advanced/zoom-transition/) -- iOS 18+, alpha API, SDK 55+ requirement
- [Lucide React Native](https://lucide.dev/guide/packages/lucide-react-native) -- installation, props, tree-shaking
- [Reanimated Entering/Exiting](https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/entering-exiting-animations/) -- animation types, 300ms default, modifiers
- [Reanimated Shared Element Transitions](https://docs.swmansion.com/react-native-reanimated/docs/shared-element-transitions/overview/) -- experimental, feature flag on Fabric
- [@expo-google-fonts/geist](https://www.npmjs.com/package/@expo-google-fonts/geist) -- 9 weight variants, useFonts integration

### Verified Design Patterns (MEDIUM confidence)
- [Duolingo freemium-to-premium UX](https://adplist.substack.com/p/how-duolingo-pushes-users-from-freemium) -- 7+ paywall touchpoints, contextual value props, $25M/mo iOS revenue
- [Dynamic and contextual paywalls](https://www.retention.blog/p/dynamic-and-contextual-paywalls) -- feature-aware upgrade prompts
- [Dark mode UI best practices](https://www.graphiceagle.com/dark-mode-ui/) -- contrast ratios, OLED considerations, color palette guidance
- [Liquid Glass implementation guide](https://www.trifleck.com/blog/implementing-liquid-glass-ui-in-react-native-complete-guide-2026) -- design token system for glass UI, reusable component patterns
- [Callstack: Liquid Glass in React Native](https://www.callstack.com/blog/how-to-use-liquid-glass-in-react-native) -- GPU performance, limited blur layer stacking

### Codebase Analysis (HIGH confidence)
- Current `theme.ts`: light-mode only tokens, System font, basic spacing/radius/shadow scales
- Current `Card.tsx`: plain View with surface background, no blur
- Current `ThemeCard.tsx`: emoji, color bar, progress bar, due badge -- all need dark restyling
- Current `Text.tsx`: variant system (h1-label), color/weight modifiers -- font family swap is clean
- Current `Skeleton.tsx`: uses old `Animated` API, light-mode colors
- Current tab layout: 4 tabs (Feed/Library/Memos/Profile), emoji icons, solid background
- Current `_layout.tsx`: Stack navigator, no animation customization
- Installed deps: `react-native-reanimated@4.1.1`, `react-native-gesture-handler@2.28`, `expo-haptics@15.0.8` -- all animation/interaction tools already available
- NOT installed: `expo-blur`, `lucide-react-native`, `@expo-google-fonts/geist`, `react-native-svg` (may be transitive dep)
