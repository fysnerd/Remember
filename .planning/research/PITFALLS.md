# Domain Pitfalls: Glass UI Design System Migration

**Domain:** Glass UI dark mode design system added to existing Expo React Native app
**Researched:** 2026-02-11
**Codebase analyzed:** Ankora iOS (Expo SDK 54, React 19.1.0, React Native 0.81.5, New Architecture enabled)

---

## Critical Pitfalls

Mistakes that cause native rebuilds, broken OTA updates, rewrites, or major regressions.

---

### Pitfall 1: Native Dependency Chain Forces Mandatory Rebuild Before Any Visual Changes Ship

**What goes wrong:** The Glass UI migration requires three new native modules that are NOT currently installed: `expo-blur`, `react-native-svg` (required by lucide-react-native), and `lucide-react-native` itself. Since the project uses `runtimeVersion: { "policy": "appVersion" }` and these are native modules, ANY OTA update (`eas update`) that references BlurView or Lucide icons will crash on the existing production binary. The existing binary simply does not contain the native code for these modules.

**Why it happens:** Developers often think "I'll start migrating screens and push OTA updates incrementally." But the very first screen that imports `BlurView` from `expo-blur` or any icon from `lucide-react-native` will fail at runtime on the old binary because the native module does not exist.

**Consequences:**
- App crash on production if an OTA update references missing native modules
- Users on old binary get broken app until they update from App Store
- Rollback complexity if partial migration was shipped

**Prevention:**
1. Install ALL native dependencies FIRST: `npx expo install expo-blur react-native-svg` plus `npm install lucide-react-native --legacy-peer-deps`
2. Do a full `eas build --profile production --platform ios --auto-submit` BEFORE pushing any OTA updates that use the new modules
3. Only after the new binary is live on TestFlight/App Store, ship OTA updates using the new components
4. Consider switching `runtimeVersion` to `{ "policy": "fingerprint" }` which auto-detects native dependency changes instead of relying on appVersion

**Detection:** Build will succeed locally but OTA updates will crash on older binaries. Test by running the current production binary (not dev client) and verifying module availability.

**Roadmap phase:** Must be addressed in Phase 1 (Foundation) -- install dependencies and ship new binary before any UI migration work begins.

**Confidence:** HIGH -- verified by examining `ios/package.json` (no `expo-blur`, no `react-native-svg`) and Expo documentation on OTA/native module compatibility.

**Sources:**
- [EAS Update Documentation](https://docs.expo.dev/eas-update/introduction/)
- [Expo Updates Runtime Version](https://docs.expo.dev/versions/latest/sdk/updates/)

---

### Pitfall 2: Lucide-React-Native Has React 19 Peer Dependency Conflict and New Architecture Risk

**What goes wrong:** The project uses React 19.1.0 (via Expo SDK 54 / React Native 0.81.5). Lucide-react-native's peer dependency declares `react@"^16.5.1 || ^17.0.0 || ^18.0.0"` -- React 19 is NOT listed. Standard `npm install` will fail with ERESOLVE errors. Additionally, lucide-react-native is marked as "Untested on New Architecture" and this project has `newArchEnabled: true` in `app.json`.

**Why it happens:** Lucide maintainers have not yet updated peer dependencies to include React 19. Multiple GitHub issues (#2845, #3185, #2134, #2951) track this, but no official fix has shipped as of early 2026.

**Consequences:**
- `npm install lucide-react-native` fails outright
- Using `--legacy-peer-deps` or `--force` bypasses the check but does not guarantee runtime compatibility
- Potential rendering issues on New Architecture (Fabric) since untested
- Icons have been reported to render in Expo Go but fail in development builds and production builds

**Prevention:**
1. Install with `npm install lucide-react-native --legacy-peer-deps`
2. Immediately test icon rendering in a DEVELOPMENT BUILD (not Expo Go) -- this is the critical validation step
3. Test on a real device with a production-profile build (`eas build --profile preview`) before committing to this library
4. Have a fallback plan ready: if lucide-react-native fails on New Architecture, use `react-native-svg` directly with Lucide SVG path data copied from the [lucide icon set](https://lucide.dev/icons/), or create a custom icon font from Lucide SVGs using a tool like [Icomoon](https://icomoon.io/)

**Detection:** Install failure is immediate. Runtime failure only appears in non-Expo-Go builds. Test with `eas build --profile preview` and install on a real device.

**Roadmap phase:** Must be validated in Phase 1 (Foundation) with a proof-of-concept build before any other work begins.

**Confidence:** HIGH -- React 19 incompatibility confirmed via multiple GitHub issues. New Architecture status confirmed via Expo compatibility check.

**Sources:**
- [GitHub Issue #3185 - Not installing in RN 0.78 with React 19](https://github.com/lucide-icons/lucide/issues/3185)
- [GitHub Issue #2845 - Peer dependency conflict](https://github.com/lucide-icons/lucide/issues/2845)
- [GitHub Issue #2713 - Working in Expo Go but not dev builds](https://github.com/lucide-icons/lucide/issues/2713)
- [Lucide React Native Guide](https://lucide.dev/guide/packages/lucide-react-native)

---

### Pitfall 3: Custom Font (Geist) + fontWeight = Silent Rendering Failures

**What goes wrong:** The current Text component (`ios/components/ui/Text.tsx`) uses `fontFamily: 'System'` in `theme.ts` with `fontWeight: '400' | '500' | '700'` in the variant/weight maps. This works because the system font supports all weights natively. When switching to Geist, using `fontFamily: 'Geist'` with `fontWeight: '700'` will NOT render bold text. React Native on iOS ignores `fontWeight` when a custom font is loaded -- it only uses the weight embedded in the specific font file. You must load separate `.ttf` files for each weight and reference each as a different `fontFamily` name.

**Why it happens:** React Native's font system on iOS does not support CSS-like font-weight mapping for custom fonts. Each weight must be a separate font file registered under a distinct name. The Geist font is distributed primarily as a variable font (single `.ttf`/`.woff2`), but React Native does not support variable fonts -- you must obtain or generate static weight files (Geist-Regular.ttf, Geist-Medium.ttf, Geist-SemiBold.ttf, Geist-Bold.ttf).

**Consequences:**
- All text renders in Regular weight regardless of the `fontWeight` prop
- Subtle and easy to miss -- text still appears, just with the wrong weight
- Every component using `weight="bold"` or `weight="medium"` silently downgrades to regular
- The Text component's `weightMap` approach (returning `fontWeight: '700'`) completely breaks
- 103 instances of `fontWeight`/`fontSize`/`fontFamily` across 30 files in the codebase would need auditing

**Prevention:**
1. Download Geist as static weight files (Regular, Medium, SemiBold, Bold) from the [Geist GitHub repository](https://github.com/vercel/geist-font/tree/main/packages/next/dist/fonts/geist-sans) -- do NOT use the variable font file
2. Restructure the `fonts` export in `theme.ts` to map weight names to specific font family names:
   ```typescript
   // BEFORE (broken with custom fonts):
   export const fonts = {
     regular: 'System',
     medium: 'System',
     bold: 'System',
   } as const;

   // AFTER (correct with custom fonts):
   export const fonts = {
     regular: 'Geist-Regular',
     medium: 'Geist-Medium',
     semibold: 'Geist-SemiBold',
     bold: 'Geist-Bold',
   } as const;
   ```
3. Update the Text component to use `fontFamily` instead of `fontWeight` for weight selection:
   ```typescript
   // WRONG: { fontWeight: weightMap[weight] } with custom font
   // RIGHT: { fontFamily: fonts[weight || 'regular'] }
   ```
4. Remove ALL `fontWeight` usage from `StyleSheet.create` blocks across the codebase -- replace each with the correct `fontFamily` reference
5. Load all font files via `expo-font` in the root layout using the `useFonts()` hook
6. Keep the splash screen visible (`SplashScreen.preventAutoHideAsync()`) until fonts are loaded

**Detection:** Visual inspection -- all text appears the same weight. Automated: grep for `fontWeight:` in `.tsx` files after migration; any remaining instances indicate missed conversions.

**Roadmap phase:** Phase 1 (Foundation) -- font infrastructure must be correct before migrating any screens.

**Confidence:** HIGH -- this is a well-documented React Native limitation confirmed by Expo docs and multiple GitHub issues.

**Sources:**
- [Expo Fonts Documentation](https://docs.expo.dev/develop/user-interface/fonts/)
- [GitHub Issue #27647 - expo-font doesn't respect fontFamily + fontWeight](https://github.com/expo/expo/issues/27647)
- [GitHub Issue #9149 - fontWeight doesn't work on iOS with custom font](https://github.com/expo/expo/issues/9149)
- [GitHub Issue #42116 - fontWeight not applied with custom font](https://github.com/facebook/react-native/issues/42116)

---

### Pitfall 4: expo-blur BlurView + Reanimated Animated Props = Broken on iOS

**What goes wrong:** Animating BlurView's `intensity` prop with `react-native-reanimated`'s `useAnimatedProps` does not work reliably. Passing a shared value to `intensity` or using `useAnimatedProps` has no visual effect on iOS -- the blur does not animate. This kills planned micro-interactions like "glass card entrance" and "blur transition" effects for the design system.

**Why it happens:** BlurView's `intensity` prop is not properly bridged with Reanimated's native animation driver on iOS. The native blur implementation does not respond to animated prop updates through the Reanimated bridge. This has been reported across multiple SDK versions (GitHub issues #32781, #23539, #22116, and Reanimated issue #6733).

**Consequences:**
- Planned animations like "card slides up while background blurs in" simply do not work
- Developers spend hours debugging why animation code is correct but nothing happens visually
- Falling back to JS-driven animation for blur intensity causes visible jank (defeats the purpose of Reanimated)

**Prevention:**
1. Do NOT plan any animations that depend on animating BlurView `intensity`
2. Use BlurView with a STATIC intensity value (e.g., `intensity={40}`) and animate OTHER properties (opacity, translateY, scale) of the BlurView's container or wrapper
3. For "blur in" effects, animate the opacity of a wrapper View:
   ```tsx
   <Animated.View style={[{ opacity: animatedOpacity }]}>
     <BlurView intensity={60} tint="dark">
       {children}
     </BlurView>
   </Animated.View>
   ```
4. For "glass card entrance" animations, animate the card's translateY and opacity, with the BlurView always at full intensity -- this gives the impression of blur appearing without actually animating blur
5. If variable blur is essential for a specific feature, investigate `@react-native-community/blur` which has reported better Reanimated integration, but verify Expo SDK 54 compatibility first

**Detection:** Animation code runs without errors but blur stays at initial value or does not appear. Test by adding a button that toggles a shared value controlling intensity.

**Roadmap phase:** Phase 2 (Component Library) -- when building glass card components, design all animations around static blur.

**Confidence:** HIGH -- confirmed by multiple Expo GitHub issues across SDK versions.

**Sources:**
- [Expo Issue #32781 - Cannot animate BlurView intensity with Reanimated](https://github.com/expo/expo/issues/32781)
- [Expo Issue #23539 - BlurView with Reanimated doesn't render correctly](https://github.com/expo/expo/issues/23539)
- [Reanimated Issue #6733 - useAnimatedProps not re-rendering with BlurView.intensity](https://github.com/software-mansion/react-native-reanimated/issues/6733)
- [Expo Issue #22116 - Animated Blur Does Not Work](https://github.com/expo/expo/issues/22116)

---

### Pitfall 5: White Flash of Death on App Launch (Splash Screen Mismatch)

**What goes wrong:** The current `app.json` has `splash.backgroundColor: "#ffffff"` (white). After migrating to the Night Blue dark mode (`#0a0f1a`), the app will show a jarring white splash screen for 0.5-2 seconds before the dark UI renders. This is commonly called the "White Flash of Death" and happens because the native splash screen loads before any JavaScript executes.

**Why it happens:** The splash screen is configured at the native level (in `app.json`) and renders before any React code runs. If the splash background is white but the app background is dark, there is an unavoidable white-to-dark transition. Additionally, the current `userInterfaceStyle: "automatic"` setting means the system may pick a style that does not match the app's forced dark mode.

**Consequences:**
- Every cold app launch has a bright white flash before the dark UI appears
- Feels broken and unprofessional
- Users in dark rooms get blinded on every launch
- The `LoadingScreen` component (used during auth check) will also flash white if it uses the old background color

**Prevention:**
1. Update `app.json` BEFORE the native rebuild:
   ```json
   {
     "splash": {
       "backgroundColor": "#0a0f1a",
       "image": "./assets/images/splash-icon-dark.png"
     },
     "userInterfaceStyle": "dark"
   }
   ```
2. Set `userInterfaceStyle` to `"dark"` (not `"automatic"`) since the app will be dark-mode-only
3. This is a native configuration change -- requires `eas build`, NOT just `eas update`
4. Create a dark-background-compatible version of the splash icon (current icon may not be visible on dark background if it uses dark colors)
5. Add `<StatusBar style="light" />` in the root layout to ensure light status bar text on dark background
6. Update the `LoadingScreen` component's background to match the dark theme

**Detection:** Launch the app from cold start (kill it first). If you see a white flash, the splash config is wrong.

**Roadmap phase:** Phase 1 (Foundation) -- must be included in the same native build that adds expo-blur and react-native-svg.

**Confidence:** HIGH -- splash backgroundColor is currently `#ffffff` in `app.json`, verified by reading the file. The white flash problem is extensively documented.

**Sources:**
- [White Flash of Death - Solving Theme Flickering in React Native](https://medium.com/@ripenapps-technologies/the-white-flash-of-death-solving-theme-flickering-in-react-native-production-apps-d732af3b4cae)
- [Expo Color Themes Documentation](https://docs.expo.dev/develop/user-interface/color-themes/)
- [Expo StatusBar Configuration](https://docs.expo.dev/guides/configuring-statusbar/)

---

## Moderate Pitfalls

Issues that cause significant rework or visual bugs but are recoverable.

---

### Pitfall 6: 229 Color References + 6 Hardcoded Hex + 17 rgba() Values Across 42 Files

**What goes wrong:** The current codebase has 229 references to `colors.X` spread across 42 `.tsx` files, plus 6 instances of hardcoded hex colors and approximately 17 instances of `rgba()` values that assume a light background. Simply swapping the color values in `theme.ts` will create a mix of broken and working UI because the hardcoded values bypass the theme system.

**Specific breakage points identified:**
- `color: '#FFFFFF'` in `ContentCard.tsx` (badge text, duration text) -- becomes invisible on white glass surfaces
- `color: '#FFFFFF'` in `ThemeCard.tsx` -- same problem
- `backgroundColor: '#6366F1'` in `QuestionCard.tsx` -- hardcoded purple does not match Night Blue palette
- `color: '#000000'` in `profile.tsx` (sync button text) -- invisible on dark background
- `rgba(0, 0, 0, 0.7)` overlay badges in `ContentCard.tsx` -- become redundant/invisible on dark backgrounds
- `rgba(255, 255, 255, 0.95)` checkboxes in `ContentCard.tsx` -- become glaring white blobs on dark backgrounds
- `colors.accent: '#0A0A0A'` (currently black) used for primary buttons -- becomes invisible on `#0a0f1a` background

**Why it happens:** The original theme was monochrome light -- `accent` was black, `inverse` mapped to `background` (white). These semantic names work for light mode but break when the background becomes dark. The color semantics need rethinking, not just value swapping.

**Prevention:**
1. Before touching `theme.ts`, audit ALL hardcoded colors using this map:
   ```
   Hardcoded hex values: 6 instances in 4 files
     - ContentCard.tsx: '#FFFFFF' (x2)
     - ThemeCard.tsx: '#FFFFFF' (x1)
     - QuestionCard.tsx: '#6366F1', '#FFFFFF' (x2)
     - profile.tsx: '#000000' (x1)
   Hardcoded rgba values: ~17 instances in 13 files
   Theme color references: 229 across 42 files
   ```
2. Create new semantic color tokens for Glass UI BEFORE changing existing values:
   ```typescript
   // Add glass-specific tokens alongside existing ones:
   glass: 'rgba(255, 255, 255, 0.08)',
   glassBorder: 'rgba(255, 255, 255, 0.12)',
   glassHighlight: 'rgba(255, 255, 255, 0.15)',
   onGlass: 'rgba(255, 255, 255, 0.9)',
   onDark: '#FFFFFF',
   onAccent: '#FFFFFF',
   ```
3. Replace hardcoded colors with semantic tokens file-by-file using a migration checklist
4. Do NOT change `theme.ts` color values until ALL hardcoded colors have been tokenized first
5. Run a "dark mode audit" pass: open every screen with the new colors and check for invisible text, invisible buttons, and contrast violations

**Detection:** Global search for `#[0-9a-fA-F]` and `rgba(` in `.tsx` files after migration. Any remaining non-token colors are migration gaps.

**Roadmap phase:** Phase 1 (Foundation) -- audit and plan token structure. Phase 2 (Component Library) -- fix in UI components. Phase 3 (Screen Migration) -- fix in screen files.

**Confidence:** HIGH -- exact counts verified by grep analysis of the current codebase.

---

### Pitfall 7: Stacking Multiple BlurViews in Lists Destroys Scroll Performance

**What goes wrong:** If every Card component becomes a glass card with `BlurView`, a FlatList showing 10+ content cards means 10+ simultaneous BlurView instances. On iOS this causes significant frame drops (below 60fps, dropping to 30-40fps). The GPU cannot handle real-time blur computation for many overlapping translucent surfaces simultaneously.

**Why it happens:** Each BlurView performs a real-time Gaussian blur on its background content. This is GPU-intensive. When scrolling a list, the blur must be recomputed every frame as the background content changes behind the view. Stacking more than 3-4 BlurViews on screen simultaneously compounds the GPU workload. Expo's own documentation explicitly warns: "BlurView on Android is computationally expensive, so it is recommended not to render more than a few BlurView components at once."

**Performance context for this project:** The Feed tab (`ios/app/(tabs)/index.tsx`) shows ThemeCards in a grid, and the Library tab (`ios/app/(tabs)/library.tsx`) shows ContentCards in a scrollable list. Both will have 10+ cards visible or near-visible at once.

**Consequences:**
- Scroll jank on the Feed and Library tabs
- Battery drain from GPU over-utilization
- Particularly bad on iPhone SE (2nd/3rd gen), iPhone XR, and other 3GB RAM devices
- FlatList recycling does not help because ALL visible cards need active blur simultaneously

**Prevention:**
1. Reserve real `BlurView` for STATIC, non-list surfaces only: tab bar background, modal overlays, navigation headers, feature highlight cards (max 2-3 on screen at once)
2. For list items (ContentCard, ThemeCard), use a "faux-glass" pattern -- solid semi-transparent background with a border to simulate the glass look without the GPU cost:
   ```typescript
   // GOOD for list items -- faux glass (zero GPU blur cost):
   {
     backgroundColor: 'rgba(255, 255, 255, 0.06)',
     borderWidth: 1,
     borderColor: 'rgba(255, 255, 255, 0.10)',
     borderRadius: 16,
   }

   // BAD for list items -- real blur in every card:
   <BlurView intensity={20} tint="dark">{cardContent}</BlurView>
   ```
3. Establish a hard rule: maximum 3 BlurView components visible simultaneously on any screen
4. Profile with Xcode Instruments (Core Animation / GPU profiler) on the oldest supported iPhone to verify sustained 55+ fps during scrolling

**Detection:** Run app on oldest supported iPhone, scroll the Feed rapidly, and watch for frame drops in Xcode's performance monitor. Frame drops below 50fps during scrolling indicate too many blur views.

**Roadmap phase:** Phase 2 (Component Library) -- establish the pattern of which surfaces get real blur vs faux-glass BEFORE building any screen components.

**Confidence:** HIGH -- expo-blur documentation explicitly warns about this. Community reports confirm performance degradation with multiple BlurViews.

**Sources:**
- [BlurView - Expo Documentation](https://docs.expo.dev/versions/latest/sdk/blur-view/)
- [Implementing Glass UI in React Native - Cygnis](https://cygnis.co/blog/implementing-liquid-glass-ui-react-native/)
- [Expo Issue #23239 - Android decreased performance with expo-blur](https://github.com/expo/expo/issues/23239)

---

### Pitfall 8: Tab Navigation Restructure Breaks Deep Links, Auth Guard, and Back Navigation

**What goes wrong:** The current 4-tab structure (Feed/Library/Memos/Profile) is being restructured to (Home/Explorer/Revisions/Profile). In expo-router, tabs are file-based -- renaming files inside `app/(tabs)/` changes route paths. This breaks several hardcoded references found in the codebase.

**Specific breakage points in the current code:**
- `router.replace('/(tabs)')` in `app/_layout.tsx` line 45 -- assumes the `(tabs)` group exists at that path
- `headerBackTitle: 'Feed'` in `app/_layout.tsx` line 65 -- shows "Feed" label even after renaming the tab to "Home"
- `headerBackTitle: 'Retour'` in `app/_layout.tsx` lines 69, 137, 149 -- potentially needs updating if screens move
- Deep link scheme `ankora://` with associated domains `applinks:api.ankora.study` -- if route names change, deep links break
- Typed routes (`experiments.typedRoutes: true` in app.json) will throw TypeScript errors if route files are renamed

**Consequences:**
- Users clicking deep links get "route not found" errors
- Auth redirect may loop or go to wrong screen after tab rename
- Back buttons show stale labels ("Feed" instead of "Home")
- TypeScript compilation errors from stale typed route references
- Stale navigation state from previous app version may cause crashes on update

**Prevention:**
1. Keep the `(tabs)` directory name UNCHANGED -- only rename/add/remove files inside it
2. If renaming `index.tsx` to something else, make sure a new `index.tsx` exists (expo-router expects an index route in each layout group)
3. Update ALL hardcoded route references found in `app/_layout.tsx`:
   - `router.replace('/(tabs)')` -- verify this still resolves correctly
   - All `headerBackTitle` strings
4. After restructure, test every deep link pattern: `npx uri-scheme open ankora://content/123 --ios`
5. Clear navigation state on app update or handle stale state gracefully with a try-catch around navigation operations
6. Run TypeScript compilation (`npx tsc --noEmit`) after any file rename to catch typed route errors immediately

**Detection:** Test every deep link pattern and every back button after restructure. TypeScript compiler will catch route reference errors if typed routes are enabled.

**Roadmap phase:** Phase 3 (Screen Migration) -- when restructuring navigation. Plan the file rename map BEFORE executing.

**Confidence:** HIGH -- current hardcoded routes verified by reading `app/_layout.tsx` and `app/(tabs)/_layout.tsx`.

---

### Pitfall 9: Reanimated Entry/Exit Layout Animations Cause Memory Leaks on List Items

**What goes wrong:** Adding `entering={FadeInDown}` and `exiting={FadeOut}` layout animations to list items or frequently mounted/unmounted components causes steadily growing memory consumption. Memory allocated by animated components is not fully released on unmount. In an app like Ankora where users scroll through content feeds and navigate back and forth between screens, this compounds over a session.

**Why it happens:** Reanimated's layout animation system allocates native animation resources that are not properly cleaned up when components unmount. `useSharedValue` hooks also leak memory -- each mount allocates resources that are never freed. This has been documented across Reanimated v3 and v4 (GitHub issues #4322, #5280, #5614, #5800, #4236).

**Specific concern for this project:** The project already has `react-native-reanimated: ~4.1.1` installed. Adding entering/exiting animations to ContentCard, ThemeCard, or other list items will trigger these leaks during normal scroll and navigation usage.

**Consequences:**
- Memory usage grows 2-5MB per minute of active scrolling/navigation
- App eventually gets killed by iOS memory pressure (jetsam) after 15-30 minutes of heavy use
- Particularly bad on 3GB RAM devices (iPhone SE 2nd gen, iPhone XR)
- Hard to detect in development because dev sessions are short

**Prevention:**
1. NEVER use `entering`/`exiting` layout animations on list items (ContentCard, ThemeCard, or any FlatList/ScrollView child)
2. Reserve Reanimated layout animations for one-time screens only: onboarding flow, quiz completion celebration, achievement unlock, modal presentations
3. For list item animations (card appear on scroll), use `Animated.View` with manual `withTiming`/`withSpring` that you control and clean up via `cancelAnimation` in a cleanup function
4. If using `useSharedValue`, limit usage to components that are mounted for the entire session (tab bar, sticky headers) -- never in list items
5. Profile memory usage over a 10-minute session using Xcode Instruments (Allocations instrument) before shipping -- memory should plateau, not grow linearly
6. Consider using the built-in React Native `LayoutAnimation` for simple list animations (no leak issue since it is handled by UIKit/CoreAnimation, not Reanimated)

**Detection:** Monitor memory in Xcode Instruments over 10+ minutes of normal usage. If memory grows linearly without plateauing, entering/exiting animations are the likely cause.

**Roadmap phase:** Phase 2 (Component Library) -- establish animation patterns that avoid leaks. Phase 4 (Polish) -- validate with extended session testing.

**Confidence:** MEDIUM -- memory leak issues are well-documented in Reanimated v3/v4, but some fixes have been applied in later releases. The exact behavior with Reanimated 4.1.1 and New Architecture needs hands-on testing.

**Sources:**
- [Reanimated Issue #4322 - Entry/Exit animation causes memory leak](https://github.com/software-mansion/react-native-reanimated/issues/4322)
- [Reanimated Issue #5280 - Memory leak when destroying animated component](https://github.com/software-mansion/react-native-reanimated/issues/5280)
- [Reanimated Issue #5800 - Memory leak in useSharedValue](https://github.com/software-mansion/react-native-reanimated/issues/5800)
- [Reanimated Issue #4236 - Memory leak linked to useAnimatedStyles](https://github.com/software-mansion/react-native-reanimated/issues/4236)

---

## Minor Pitfalls

Issues that cause polish problems or developer confusion but are quick to fix.

---

### Pitfall 10: StatusBar Text Color Not Updating After Dark Mode Switch

**What goes wrong:** The current root layout (`app/_layout.tsx`) does not include an explicit `<StatusBar>` component. With a dark background, the default dark status bar text becomes invisible (dark text on dark background). Even when adding `<StatusBar style="light" />`, there are known issues with expo-status-bar not respecting theme changes on certain screen transitions, particularly when using `presentation: 'modal'` (used for oauth/[platform] screen).

**Prevention:**
1. Add `<StatusBar style="light" />` from `expo-status-bar` at the root layout level (inside `RootLayout` component in `app/_layout.tsx`)
2. Also add it explicitly to modal screens (`oauth/[platform]`) which can reset status bar style on iOS
3. Set `userInterfaceStyle: "dark"` in `app.json` to give the system a consistent hint
4. Test status bar visibility on EVERY screen, especially after modal dismiss

**Roadmap phase:** Phase 1 (Foundation) -- add alongside splash screen changes.

**Confidence:** MEDIUM -- known issues exist but exact behavior depends on SDK 54 + expo-router combination.

**Sources:**
- [Expo StatusBar Documentation](https://docs.expo.dev/versions/latest/sdk/status-bar/)
- [Expo Issue #27278 - Router status bar doesn't respect theme](https://github.com/expo/expo/issues/27278)

---

### Pitfall 11: Emoji Tab Icons Cannot Be Incrementally Replaced With Lucide SVG Icons

**What goes wrong:** The current tab bar uses emoji characters for icons (`'home': '\ud83c\udfe0'`, `'grid': '\ud83d\udcda'`, `'brain': '\ud83e\udde0'`, `'user': '\ud83d\udc64'`) rendered as `<Text>` in the `TabIcon` function. These cannot be incrementally replaced with Lucide SVG icons -- the entire `TabIcon` component pattern must change from rendering a `<Text>` element to rendering an SVG component. The tab bar API expects a component that accepts `{ color, size, focused }` props, which matches Lucide's API, but the wrapper must change completely.

**Prevention:**
1. Create a new `TabBarIcon` component that renders Lucide icons and accepts the tab bar icon API:
   ```tsx
   import { Home, Compass, Brain, User } from 'lucide-react-native';
   const iconMap = { home: Home, explore: Compass, revisions: Brain, profile: User };
   function TabBarIcon({ name, color, size }: { name: string; color: string; size: number }) {
     const Icon = iconMap[name];
     return <Icon color={color} size={size} />;
   }
   ```
2. Replace the entire TabIcon function in one go (not incrementally per tab) to avoid mixing emoji and SVG rendering
3. Lucide icons accept `color` and `size` props directly, which maps cleanly to the tab bar API
4. Also requires `react-native-svg` to be installed (covered in Pitfall 1)

**Roadmap phase:** Phase 3 (Screen Migration) -- when restructuring tab navigation.

**Confidence:** HIGH -- current implementation verified in `app/(tabs)/_layout.tsx`.

---

### Pitfall 12: Shadows Become Invisible on Dark Backgrounds

**What goes wrong:** The current `shadows` tokens in `theme.ts` use `shadowColor: '#000'` with very low opacity (0.04-0.08). On the dark `#0a0f1a` background, these shadows are completely invisible. The entire elevation/depth system breaks -- cards look flat and indistinguishable from the background.

**Current shadow values from theme.ts:**
```typescript
sm: { shadowColor: '#000', shadowOpacity: 0.04 }  // invisible on dark
md: { shadowColor: '#000', shadowOpacity: 0.06 }  // invisible on dark
lg: { shadowColor: '#000', shadowOpacity: 0.08 }  // invisible on dark
```

**Prevention:**
1. Replace shadow-based elevation with border-based elevation for the Glass UI dark mode:
   ```typescript
   elevation: {
     sm: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.06)' },
     md: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.10)' },
     lg: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)' },
   }
   ```
2. For Glass UI, depth is communicated through border luminosity and background opacity, not shadows
3. Optionally add a subtle top-edge highlight (1px lighter border on top) for a "glass edge" effect
4. Consider `shadowColor: '#ffffff'` with very low opacity (0.05-0.10) for a subtle glow effect on important elevated elements like floating action buttons

**Roadmap phase:** Phase 1 (Foundation) -- include in theme token redesign.

**Confidence:** HIGH -- basic CSS/design knowledge, verified by examining current shadow values in `theme.ts`.

---

### Pitfall 13: Skeleton Loading Component Uses Animated API (Not Reanimated) and Light-Mode Colors

**What goes wrong:** The current `Skeleton.tsx` uses React Native's built-in `Animated` API (from `react-native`) for its pulse animation. If the rest of the app migrates to Reanimated for all animations, mixing Animated and Reanimated can cause subtle conflicts on the same views. More importantly, the Skeleton component uses `colors.border` (currently `#E5E5E5` -- a light gray) for its background, which will be invisible or wrong on the dark Night Blue background.

**Prevention:**
1. Migrate Skeleton to use Reanimated's `withRepeat(withTiming(...))` for the pulse effect instead of `Animated.loop(Animated.sequence(...))`
2. Update the skeleton color to a dark-mode-appropriate value (e.g., `rgba(255, 255, 255, 0.08)` pulsing to `rgba(255, 255, 255, 0.15)`)
3. Do this migration in the Component Library phase alongside other UI component updates

**Roadmap phase:** Phase 2 (Component Library).

**Confidence:** HIGH -- verified by reading `Skeleton.tsx` source code.

---

### Pitfall 14: expo-blur on SDK 54 = iOS Only (Android Falls Back to Translucent View)

**What goes wrong:** On Expo SDK 54, `expo-blur` only provides native blur on iOS. On Android, it renders a plain `View` with a translucent background color instead of an actual blur effect. While Ankora is currently iOS-only, this matters if Android support is ever planned. Starting with SDK 55, expo-blur gained stable Android support, but upgrading SDK is a separate migration.

**Prevention:**
1. For current iOS-only scope: no action needed, blur works natively
2. Document that moving to Android will require either SDK 55+ upgrade or an alternative blur approach
3. The faux-glass pattern (semi-transparent backgrounds with borders, recommended in Pitfall 7 for list items) naturally works cross-platform as a fallback

**Roadmap phase:** No immediate phase impact. Document as future consideration.

**Confidence:** HIGH -- confirmed by Expo SDK 54 documentation and expo-blur npm page.

**Sources:**
- [BlurView - Expo Documentation](https://docs.expo.dev/versions/latest/sdk/blur-view/)
- [Expo SDK 55 Changelog - Android blur support](https://expo.dev/changelog/sdk-55-beta)

---

### Pitfall 15: BlurView Rendering Order Bug With FlatList

**What goes wrong:** If a BlurView is rendered BEFORE the dynamic content it sits on top of (common with overlay patterns), the blur effect does not update when the content underneath changes. This affects patterns like "blurred tab bar overlaying a scrolling FlatList" -- the blur shows the initial state and never updates as the user scrolls.

**Prevention:**
1. Always render BlurView AFTER the content component in the JSX tree (later in the tree = rendered on top)
2. For tab bar blur overlays, use `position: 'absolute'` on the BlurView and place it after the content in the component tree:
   ```tsx
   <View style={{ flex: 1 }}>
     <FlatList data={...} />  {/* Content rendered first */}
     <BlurView            {/* Blur overlay rendered second */}
       style={StyleSheet.absoluteBottom}
       intensity={80}
       tint="dark"
     />
   </View>
   ```
3. Test blur overlays with scrollable content to verify the blur updates during scroll

**Roadmap phase:** Phase 2 (Component Library) -- when building glass surface patterns.

**Confidence:** MEDIUM -- documented in expo-blur GitHub issues, but behavior may vary with SDK version.

**Sources:**
- [Expo Issue #6613 - BlurView doesn't update blur](https://github.com/expo/expo/issues/6613)

---

## Phase-Specific Warnings Summary

| Phase | Likely Pitfall | Severity | Mitigation |
|-------|---------------|----------|------------|
| **Phase 1: Foundation** | Native deps require rebuild before any OTA (Pitfall 1) | CRITICAL | Install expo-blur + react-native-svg + lucide, do `eas build` first |
| **Phase 1: Foundation** | Lucide React 19 peer dep failure (Pitfall 2) | CRITICAL | Use `--legacy-peer-deps`, test in dev build immediately |
| **Phase 1: Foundation** | Geist variable font not supported in RN (Pitfall 3) | CRITICAL | Use static weight .ttf files, map fontFamily per weight |
| **Phase 1: Foundation** | White flash on launch (Pitfall 5) | HIGH | Update app.json splash backgroundColor to `#0a0f1a` |
| **Phase 1: Foundation** | Shadows invisible on dark (Pitfall 12) | MEDIUM | Switch to border-based elevation |
| **Phase 1: Foundation** | StatusBar text invisible (Pitfall 10) | MEDIUM | Add `<StatusBar style="light" />` |
| **Phase 2: Component Library** | BlurView intensity animation broken (Pitfall 4) | HIGH | Use static intensity, animate wrapper opacity |
| **Phase 2: Component Library** | Multiple BlurViews in lists = jank (Pitfall 7) | HIGH | Faux-glass for list items, real blur for overlays only |
| **Phase 2: Component Library** | Reanimated layout animations leak memory (Pitfall 9) | HIGH | No entering/exiting on list items |
| **Phase 2: Component Library** | Skeleton uses wrong API and colors (Pitfall 13) | LOW | Migrate to Reanimated + dark colors |
| **Phase 2: Component Library** | BlurView rendering order bug (Pitfall 15) | LOW | Render BlurView after content in JSX |
| **Phase 3: Screen Migration** | 229+ color refs need migration (Pitfall 6) | HIGH | File-by-file checklist, tokenize first |
| **Phase 3: Screen Migration** | Tab restructure breaks routes (Pitfall 8) | HIGH | Keep (tabs) dir, update all hardcoded routes |
| **Phase 3: Screen Migration** | Emoji icons need full replacement (Pitfall 11) | LOW | Replace TabIcon in one pass |

---

## Performance Benchmarks to Establish

Before shipping, validate these on the OLDEST supported iPhone (SE 2nd gen or XR):

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Feed scroll FPS | >55 fps sustained | Xcode Instruments > Core Animation |
| BlurViews per screen | Max 3 simultaneous | Manual audit + Xcode GPU profiler |
| Memory after 10 min use | <200MB total, stable plateau | Xcode Instruments > Allocations |
| Cold launch to interactive | <2 seconds | Stopwatch from tap to first rendered frame |
| Font loading time | <200ms (all 4 weights) | Log `useFonts()` completion timing |
| Tab switch latency | <100ms perceived | Manual testing with haptic feedback |
| Glass card render time | <16ms per card | React DevTools Profiler |

---

## Pre-Implementation Checklist

Before starting any Glass UI implementation:
- [ ] Proof-of-concept build: install expo-blur + react-native-svg + lucide, build with `eas build --profile preview`, test on real device
- [ ] Validate lucide-react-native renders correctly on New Architecture dev build
- [ ] Obtain Geist static weight .ttf files (Regular, Medium, SemiBold, Bold)
- [ ] Design complete color token palette for Night Blue Glass UI
- [ ] Update app.json: splash backgroundColor, userInterfaceStyle
- [ ] Audit all 42 files importing from theme for hardcoded colors

Before shipping to production:
- [ ] Every screen tested on dark background (no invisible text, no invisible buttons)
- [ ] Scroll performance validated on iPhone SE at 55+ fps
- [ ] Memory profiled over 10-minute session (stable, not growing)
- [ ] All deep links tested after tab restructure
- [ ] StatusBar visible on every screen including modals
- [ ] Splash screen matches app background (no white flash)
- [ ] TypeScript compilation passes with no route errors

---

## Sources

### HIGH Confidence (Verified through codebase analysis + official documentation)
- Codebase: `ios/package.json` -- no expo-blur, no react-native-svg installed
- Codebase: `ios/app.json` -- splash backgroundColor #ffffff, userInterfaceStyle automatic, newArchEnabled true
- Codebase: `ios/theme.ts` -- all color values, shadow values, font config
- Codebase: `ios/components/ui/Text.tsx` -- fontWeight-based weight system
- Codebase: `ios/app/(tabs)/_layout.tsx` -- emoji tab icons
- Codebase: `ios/app/_layout.tsx` -- hardcoded route strings
- [BlurView - Expo Documentation](https://docs.expo.dev/versions/latest/sdk/blur-view/)
- [Expo Fonts Documentation](https://docs.expo.dev/develop/user-interface/fonts/)
- [EAS Update Documentation](https://docs.expo.dev/eas-update/introduction/)
- [Lucide React Native Guide](https://lucide.dev/guide/packages/lucide-react-native)

### MEDIUM Confidence (GitHub issues with multiple confirmations)
- [Expo #32781 - BlurView + Reanimated intensity animation broken](https://github.com/expo/expo/issues/32781)
- [Expo #23539 - BlurView with Reanimated rendering issues](https://github.com/expo/expo/issues/23539)
- [Reanimated #6733 - useAnimatedProps + BlurView.intensity](https://github.com/software-mansion/react-native-reanimated/issues/6733)
- [Lucide #3185 - React 19 peer dependency](https://github.com/lucide-icons/lucide/issues/3185)
- [Lucide #2713 - Working in Expo Go but not dev builds](https://github.com/lucide-icons/lucide/issues/2713)
- [Expo #27647 - expo-font fontWeight not respected](https://github.com/expo/expo/issues/27647)
- [RN #42116 - fontWeight not applied with custom font](https://github.com/facebook/react-native/issues/42116)
- [Reanimated #4322 - Entry/exit animation memory leak](https://github.com/software-mansion/react-native-reanimated/issues/4322)
- [Reanimated #5280 - Memory leak on unmount](https://github.com/software-mansion/react-native-reanimated/issues/5280)

### LOW Confidence (Needs hands-on validation for this specific project)
- Reanimated 4.1.1 memory leak status on New Architecture (may be fixed)
- Exact expo-blur performance characteristics on SDK 54 with New Architecture
- lucide-react-native runtime behavior on Fabric renderer
