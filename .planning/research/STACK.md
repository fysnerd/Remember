# Technology Stack

**Project:** Ankora v3.0 - Night Blue Glass UI Design System
**Researched:** 2026-02-11
**Scope:** NEW additions only for Glass UI, Geist font, Lucide icons, design tokens, and micro-interactions. Existing stack (Expo SDK 54, expo-router, Zustand, TanStack React Query, react-native-reanimated ~4.1.1, react-native-gesture-handler ~2.28.0, expo-haptics, expo-font) is validated and not re-researched.

## Critical: OTA vs Native Build Assessment

Adding expo-blur, expo-linear-gradient, and react-native-svg introduces native modules not present in the current production binary. Expo autolinking only includes native code for packages in `package.json` -- these are NOT pre-bundled in existing builds.

**Verdict: ONE native build required at the start of v3.0, then all visual changes are OTA-deployable.**

The build strategy should be:

1. **Phase 1 (one-time):** Add all three native dependencies, run `eas build --profile production --platform ios --auto-submit`
2. **Phase 2+:** All theme token changes, component reskinning, animations, and screen restructuring deploy via `eas update --branch production`

This is the correct tradeoff: one build upfront unlocks unlimited OTA iterations for the entire visual overhaul.

## Recommended Stack Additions

### Visual Foundation (Native Dependencies -- Require Build)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| expo-blur | ~15.0.8 | Glass surface blur effects (BlurView) | The core of Glass UI. Renders iOS vibrancy-style frosted glass surfaces. Uses native iOS `UIVisualEffectView` for real blur, not fake opacity overlays. Animatable `intensity` prop works with existing react-native-reanimated. |
| expo-linear-gradient | ~15.0.7 | Gradient backgrounds, ambient glows, surface tints | Glass UI requires gradient underlays behind blur surfaces. LinearGradient provides the "light source" that makes glass visible. Also needed for accent glow effects on CTAs. |
| react-native-svg | ~15.12.1 | SVG rendering for Lucide icons | Required peer dependency for lucide-react-native. Not currently in project (existing @expo/vector-icons uses font-based icons, not SVG). |

**Installation (all three at once, before the build):**

```bash
cd C:\Users\vmsan\Desktop\FREE\PB\VIBE\Remember\ios
npx expo install expo-blur expo-linear-gradient react-native-svg
```

Using `npx expo install` ensures SDK 54-compatible versions are resolved automatically.

**Confidence:** HIGH -- All three are first-party Expo SDK modules listed in [BlurView docs](https://docs.expo.dev/versions/latest/sdk/blur-view/), [LinearGradient docs](https://docs.expo.dev/versions/latest/sdk/linear-gradient/), and [SVG docs](https://docs.expo.dev/versions/latest/sdk/svg/). Supported in Expo Go (confirms native compatibility with SDK 54). Version ~15.x aligns with SDK 54 package versioning.

### Icon System (JS-only -- OTA Compatible)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| lucide-react-native | ^0.563.0 | Complete icon set (1500+ icons, tree-shakable) | Clean, consistent, 24px stroke icons that match Glass UI aesthetic perfectly. Each icon imports individually (tree-shaking eliminates unused icons from bundle). SVG-based means icons scale perfectly at any size and accept `color`/`strokeWidth` props for theming. |

**React 19 compatibility note:** lucide-react-native had a peer dependency conflict with React 19 (listed `^16.5.1 || ^17.0.0 || ^18.0.0`). This was [fixed in PR #3126](https://github.com/lucide-icons/lucide/issues/3185) (merged July 2025). Version 0.563.0 (published January 2026) includes the fix. No `--legacy-peer-deps` workaround needed.

**Installation:**

```bash
cd C:\Users\vmsan\Desktop\FREE\PB\VIBE\Remember\ios
npm install lucide-react-native
```

**Why Lucide over alternatives:**

| Criterion | Lucide | @expo/vector-icons | SF Symbols |
|-----------|--------|-------------------|------------|
| Icon count | 1500+ | ~3500 (mixed quality) | 5000+ (iOS only) |
| Consistency | All same style/weight | Mixed icon sets | Excellent |
| Tree-shaking | Per-icon imports | Entire font loaded | N/A |
| Customizable | color, size, strokeWidth | color, size only | Limited in RN |
| Glass UI fit | Stroke icons match glass | Fill icons clash with glass | Great but iOS-only |
| Bundle impact | ~2KB per icon used | ~2MB font file always loaded | Zero (native) |

Lucide wins because: stroke-based icons complement glass surfaces (fill icons look heavy on transparent backgrounds), per-icon tree-shaking keeps bundles small, and `strokeWidth` prop enables visual weight tuning for different surface transparencies.

**Confidence:** HIGH -- lucide-react-native v0.563.0 is the latest release (18 days old as of 2026-02-11), React 19 peer dep fix confirmed via [GitHub issue](https://github.com/lucide-icons/lucide/issues/3185). Requires react-native-svg 12-15 per [official docs](https://lucide.dev/guide/packages/lucide-react-native).

### Typography (Font Assets -- OTA Compatible after first build)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @expo-google-fonts/geist | ^0.4.1 | Geist Sans typeface (9 weights) | Vercel's Geist is the defining typeface for modern dark UI. Geometric, highly legible at small sizes, excellent number rendering. The font screams "premium tech product" -- exactly the Night Blue aesthetic. |

**Available weights (all 9):**

- Geist_100Thin
- Geist_200ExtraLight
- Geist_300Light
- Geist_400Regular
- Geist_500Medium
- Geist_600SemiBold
- Geist_700Bold
- Geist_800ExtraBold
- Geist_900Black

**Recommended subset (load only what's needed):**

- `Geist_400Regular` -- body text, captions
- `Geist_500Medium` -- labels, buttons, secondary headings
- `Geist_600SemiBold` -- primary headings, emphasis
- `Geist_700Bold` -- display text, hero numbers (streak counts, mastery %)

Loading 4 weights instead of 9 reduces initial load time by ~55%.

**Loading approach:** Use `useFonts` hook (runtime loading), NOT the expo-font config plugin. Runtime loading is OTA-compatible -- font files are JS assets that ship with updates. The config plugin embeds fonts at build time, making them unchangeable via OTA.

**Installation:**

```bash
cd C:\Users\vmsan\Desktop\FREE\PB\VIBE\Remember\ios
npx expo install @expo-google-fonts/geist expo-font
```

Note: `expo-font` is already installed (~14.0.11). `npx expo install` will skip it if version is compatible.

**Integration with existing Text component:**

The current `Text.tsx` uses `fontFamily: fonts.regular` where `fonts.regular = 'System'`. The migration is a single change in `theme.ts`:

```typescript
// Before
export const fonts = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
} as const;

// After
export const fonts = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
} as const;
```

**Confidence:** HIGH -- @expo-google-fonts/geist v0.4.1 confirmed available on [npm](https://www.npmjs.com/package/@expo-google-fonts/geist). Uses standard `useFonts` hook from expo-font. Font loading pattern documented in [Expo Fonts guide](https://docs.expo.dev/develop/user-interface/fonts/).

### Micro-Interactions (Already Installed -- Zero Changes)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| react-native-reanimated (existing) | ~4.1.1 | All animations: spring transitions, blur intensity animation, fade-in sequences, card press feedback, progress bar fills | Already installed and configured. Reanimated v4.1.1 supports `useSharedValue`, `useAnimatedStyle`, `withSpring`, `withTiming`, layout animations (`entering`/`exiting`), and animated props including `BlurView.intensity`. Babel plugin auto-configured via `babel-preset-expo`. |
| react-native-gesture-handler (existing) | ~2.28.0 | Swipe gestures, long-press for card options, pan for drawer interactions | Already installed. Pairs with Reanimated for interruptible gesture-driven animations. |
| expo-haptics (existing) | ~15.0.8 | Tactile feedback on quiz answers, navigation, button press | Already installed. `Haptics.impactAsync()` for taps, `Haptics.notificationAsync()` for success/error. |

**No new packages needed for animations.** The existing Reanimated + GestureHandler + Haptics stack covers 100% of Glass UI micro-interaction needs:

- **Card press:** `withSpring` scale + opacity on `Pressable` via `useAnimatedStyle`
- **Screen transitions:** Layout animations with `FadeIn`, `SlideInRight` entering/exiting
- **Blur intensity:** Animate `intensity` prop on `BlurView` using Reanimated animated props
- **Progress fills:** `withTiming` on width/height shared values
- **Quiz feedback:** `withSequence` for shake (wrong) or bounce (correct) + `Haptics.notificationAsync`
- **Parallax headers:** `useAnimatedScrollHandler` drives header blur intensity based on scroll offset

**Reanimated v4 Babel plugin note:** In Reanimated 4.x with Expo SDK 54, the Babel plugin moved from `react-native-reanimated/plugin` to `react-native-worklets/plugin`. The project already has `react-native-worklets` (0.5.1) installed and uses `babel-preset-expo` which auto-configures this. No babel.config.js changes needed.

**Confidence:** HIGH -- All three packages already in `package.json` with compatible versions. Reanimated animated prop support for BlurView confirmed in [Expo BlurView docs](https://docs.expo.dev/versions/latest/sdk/blur-view/) ("`intensity` is animatable with `react-native-reanimated`").

## Design Token Architecture (Pure TypeScript -- OTA Compatible)

No library needed. The existing `theme.ts` file is the design token source. It expands from the current 5 token categories to a comprehensive Glass UI system:

```typescript
// Current tokens: colors, spacing, fonts, borderRadius, shadows, layout
// New tokens to add (same file, same pattern):

export const glass = {
  blur: { light: 20, medium: 40, heavy: 60 },
  tint: {
    surface: 'rgba(255, 255, 255, 0.05)',
    elevated: 'rgba(255, 255, 255, 0.08)',
    interactive: 'rgba(255, 255, 255, 0.12)',
  },
  border: 'rgba(255, 255, 255, 0.06)',
} as const;

export const animation = {
  spring: { damping: 15, stiffness: 150 },
  timing: { fast: 150, normal: 300, slow: 500 },
  easing: Easing.bezier(0.25, 0.1, 0.25, 1), // smooth ease-out
} as const;
```

**Why NOT a design token library (StyleDictionary, Tailwind, NativeWind, Unistyles):** The project has 8 UI components and ~15 screens. A design token library adds build steps, configuration files, and learning curve for a token set that fits in a single 80-line TypeScript file. The existing `theme.ts` → `import { colors } from '../theme'` pattern is simpler, type-safe, and requires zero tooling.

**Confidence:** HIGH -- Pure TypeScript, no dependencies, extends existing pattern.

## What NOT to Add

| Technology | Why Not |
|------------|---------|
| NativeWind / Tailwind CSS | Adds Tailwind compilation step, PostCSS config, and `className` paradigm to a project that uses StyleSheet. Migration cost is high for marginal benefit. The existing `theme.ts` token system works. |
| react-native-unistyles | Solid library but overkill for 15 screens. Adds runtime theming layer when a simple `theme.ts` import provides the same result with zero overhead. |
| @shopify/restyle | Type-safe theme components are nice but require wrapping every View/Text in theme-aware primitives. Too invasive a migration for the existing codebase. |
| react-native-skia | GPU-powered custom drawing is unnecessary. expo-blur handles blur natively. Skia would only be needed for custom shader effects (not in scope). |
| @react-native-community/blur | Older community package. expo-blur is the maintained Expo-native equivalent with better integration (animatable intensity, tint variants). |
| expo-image | Nice for optimized image loading but orthogonal to Glass UI. Current `Image` component works. Can add independently later. |
| react-native-linear-gradient | Community package. expo-linear-gradient is the Expo-maintained equivalent. Use the first-party option. |
| Moti | Animation library built on Reanimated. Adds abstraction over already-installed Reanimated v4. Direct Reanimated API is more flexible and avoids extra dependency. |
| react-native-shadow-2 | For drop shadows. On iOS, native `shadowColor/Offset/Opacity/Radius` works. On dark backgrounds, glow effects are better achieved with LinearGradient + blur than shadows. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Blur | expo-blur | @react-native-community/blur | expo-blur is first-party Expo, animatable intensity, maintained with SDK updates |
| Blur | expo-blur | react-native-skia blur shader | Skia is a heavy dependency (adds ~3MB to binary) for an effect expo-blur handles natively |
| Gradient | expo-linear-gradient | react-native-linear-gradient | First-party Expo package, guaranteed SDK compatibility, same API |
| Icons | lucide-react-native | @expo/vector-icons | Font-based icons cannot adjust strokeWidth, tree-shaking impossible, fill style clashes with glass |
| Icons | lucide-react-native | phosphor-react-native | Lucide has more icons (1500+ vs 1200+), better React 19 support, more active community |
| Icons | lucide-react-native | react-native-heroicons | Heroicons has only ~290 icons. Lucide covers more use cases. |
| Font | Geist (expo-google-fonts) | Inter | Inter is excellent but ubiquitous. Geist signals "designed for developers/power users" which matches Ankora's learning-app identity. Geist also has superior monospace numbers for stats. |
| Font | Geist (expo-google-fonts) | SF Pro (system) | SF Pro is the current font. While native-feeling, it doesn't differentiate the app. Geist creates visual identity. |
| Font loading | useFonts (runtime) | Config plugin (build time) | Config plugin requires native build for every font change. Runtime loading allows font updates via OTA. |
| Animations | Reanimated (existing) | Moti | Moti wraps Reanimated with declarative API. Extra dep for syntactic sugar when Reanimated v4 API is already clean. |
| Design tokens | Plain TypeScript | NativeWind | NativeWind requires Tailwind config, PostCSS, className migration. Existing StyleSheet + theme.ts pattern works. |
| Design tokens | Plain TypeScript | Unistyles | Good library but adds runtime overhead for theme switching. This project has ONE theme (Night Blue). No dynamic switching needed. |

## Installation Summary

### One-time native build (Phase 1)

```bash
cd C:\Users\vmsan\Desktop\FREE\PB\VIBE\Remember\ios

# Install native dependencies (require build)
npx expo install expo-blur expo-linear-gradient react-native-svg

# Install JS-only dependencies (OTA-compatible)
npm install lucide-react-native
npx expo install @expo-google-fonts/geist

# Trigger production build with auto-submit to TestFlight
eas build --profile production --platform ios --auto-submit
```

### After build: all further changes are OTA

```bash
# Every subsequent visual change
eas update --branch production --message "Glass UI: [description]"
```

## Dependency Impact

### Bundle Size Estimate

| Package | Estimated Size Impact |
|---------|----------------------|
| expo-blur | ~50KB (native, not in JS bundle) |
| expo-linear-gradient | ~30KB (native, not in JS bundle) |
| react-native-svg | ~200KB (native, not in JS bundle) |
| lucide-react-native (20 icons used) | ~40KB (tree-shaken) |
| @expo-google-fonts/geist (4 weights) | ~300KB (font files as assets) |

**Total JS bundle increase:** ~40KB (only lucide icons are in JS bundle)
**Total asset increase:** ~300KB (font files)
**Total native binary increase:** ~280KB (blur + gradient + svg)

All within acceptable limits. Current app binary is ~50MB (typical Expo app).

### Dependency Tree

```
NEW dependencies:
expo-blur ~15.0.8
  -> expo (peer, already installed)

expo-linear-gradient ~15.0.7
  -> expo (peer, already installed)

react-native-svg ~15.12.1
  -> react-native (peer, already installed)

lucide-react-native ^0.563.0
  -> react-native-svg 12-15 (peer, being added above)

@expo-google-fonts/geist ^0.4.1
  -> expo-font (peer, already installed ~14.0.11)
```

No conflicting peer dependencies. Clean dependency graph.

## Integration Points with Existing Codebase

### 1. theme.ts (Token Expansion)

Current file exports: `colors`, `spacing`, `fonts`, `borderRadius`, `shadows`, `layout`.
Add: `glass`, `animation`, `gradients` token objects. Replace `colors` with Night Blue palette.

### 2. app/_layout.tsx (Font Loading)

Add `useFonts` hook from `@expo-google-fonts/geist`. Wrap app in font-loaded gate (show splash until fonts ready).

```typescript
import { useFonts, Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold,
  });

  if (!fontsLoaded) return <LoadingScreen />;
  // ... existing layout
}
```

### 3. components/ui/Card.tsx (Glass Surface)

Replace solid `backgroundColor` with `BlurView` + `LinearGradient` tint. Same `Card` API, different visual treatment.

### 4. components/ui/Text.tsx (Font Family)

Change `fontFamily` references from `'System'` to Geist weight names. Existing variant/weight props map directly to Geist weights.

### 5. components/ui/Button.tsx (Glass + Haptics + Animation)

Add Reanimated spring scale on press, haptic feedback on press, glass surface variant.

### 6. Icon Migration

Replace emoji usage and @expo/vector-icons imports with lucide-react-native throughout screens. Per-screen migration, no big-bang required.

## Environment & Config Changes

### app.json Updates

```json
{
  "expo": {
    "userInterfaceStyle": "dark",  // Was "automatic", force dark
    "splash": {
      "backgroundColor": "#0A0E1A"  // Night Blue instead of #ffffff
    },
    "ios": {
      "infoPlist": {
        "UIUserInterfaceStyle": "Dark"  // Force dark mode on iOS
      }
    }
  }
}
```

**Note:** Changing `app.json` fields that affect `infoPlist` requires a native build. Bundle this with the dependency build in Phase 1.

### No New Environment Variables

All additions are client-side visual libraries. No API keys, no backend changes.

## Sources

### High Confidence (Official Documentation)
- [Expo BlurView Docs](https://docs.expo.dev/versions/latest/sdk/blur-view/) -- Installation, props, animatable intensity, tint variants
- [Expo LinearGradient Docs](https://docs.expo.dev/versions/latest/sdk/linear-gradient/) -- Installation, props, gradient direction
- [Expo SVG Docs](https://docs.expo.dev/versions/latest/sdk/svg/) -- react-native-svg SDK 54 compatibility
- [Expo Fonts Guide](https://docs.expo.dev/develop/user-interface/fonts/) -- useFonts vs config plugin, runtime loading
- [Expo Font API](https://docs.expo.dev/versions/latest/sdk/font/) -- expo-font SDK 54 version
- [Lucide React Native Guide](https://lucide.dev/guide/packages/lucide-react-native) -- Installation, peer deps, usage
- [Reanimated Entering/Exiting](https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/entering-exiting-animations/) -- Layout animation API
- [EAS Update Docs](https://docs.expo.dev/eas-update/introduction/) -- OTA update scope (JS + assets only)
- [Expo Autolinking](https://docs.expo.dev/modules/autolinking/) -- Only package.json deps get native-linked

### Medium Confidence (Verified Community Sources)
- [Lucide React 19 Fix (GitHub #3185)](https://github.com/lucide-icons/lucide/issues/3185) -- Peer dep fix confirmed merged July 2025
- [@expo-google-fonts/geist (npm)](https://www.npmjs.com/package/@expo-google-fonts/geist) -- v0.4.1, 9 weights available
- [Dark Glassmorphism UI Patterns](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f) -- Glass UI best practices for dark mode
- [Glassmorphism in React Native](https://mikael-ainalem.medium.com/react-native-glassmorphism-effect-deeb9951469c) -- BlurView + ImageBackground layering pattern
- [React Native Reanimated Tutorial 2026](https://www.codesofphoenix.com/articles/expo/react-native-reanimated) -- Reanimated v4 patterns with Expo SDK 54
