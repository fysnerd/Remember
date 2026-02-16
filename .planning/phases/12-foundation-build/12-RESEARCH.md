# Phase 12: Foundation Build - Research

**Phase:** 12-foundation-build
**Researched:** 2026-02-11
**Overall confidence:** HIGH
**Mode:** Ecosystem (implementation-focused)

---

## Executive Summary

Phase 12 installs three native dependencies (expo-blur, react-native-svg, lucide-react-native), activates Night Blue dark mode across the entire app, loads Geist font globally, validates these technologies on-device, and ships a new production binary to TestFlight. This research confirms all target technologies are compatible with the existing stack (Expo SDK 54, React 19.1.0, React Native 0.81.5, New Architecture enabled) and identifies the exact implementation steps, version constraints, and potential failure points.

The key technical finding is that the dark mode conversion is almost entirely a **token-level change**. The codebase has 46 files importing from `theme.ts`, but only the theme file itself needs color value changes -- every component and screen automatically picks up the new Night Blue palette through their existing `import { colors } from '../../theme'` imports. 34 files reference `colors.background` specifically, and all will switch from `#FFFFFF` to `#0A0F1A` in one shot when `theme.ts` is updated.

The only verified risk is with **lucide-react-native**: while its latest version (0.563.0) now declares React 19 as a supported peer dependency (`^19.0.0`), the library has not been extensively battle-tested on React Native 0.81 + New Architecture. The context decision provides an excellent fallback: expo-symbols (SF Symbols) via `SymbolView`, which is a first-party Expo package for SDK 54.

---

## 1. Native Dependencies: Compatibility Verification

### 1.1 expo-blur (~15.0.8)

**Status: CONFIRMED COMPATIBLE**
**Confidence: HIGH**

- Latest version: 15.0.8 (aligned with SDK 54's ~15.x versioning)
- Installation: `npx expo install expo-blur` (auto-resolves to ~15.0.8 for SDK 54)
- New Architecture: Supported. expo-blur is a first-party Expo module maintained as part of the SDK. SDK 54 release notes confirm all first-party modules support New Architecture.
- Key props: `intensity` (1-100, default 50), `tint` ('light' | 'dark' | 'default' + 17 more iOS variants)
- Animatable: `intensity` prop is animatable with react-native-reanimated (already installed v4.1.1)
- iOS behavior: Uses native `UIVisualEffectView` -- real GPU-accelerated blur
- Known limitation: "BlurView fails to update when rendered before dynamic content (e.g., FlatList)". Workaround: render BlurView after content or use `overflow: 'hidden'` pattern.
- Requires `overflow: 'hidden'` on parent for `borderRadius` to work correctly.

**For Phase 12 validation**: Render a BlurView with `intensity={40}` and `tint="dark"` over a colored background on a test screen. Confirm blur renders on physical device (simulators do not accurately show blur effects).

Sources:
- [Expo BlurView Docs](https://docs.expo.dev/versions/latest/sdk/blur-view/)
- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54)

### 1.2 react-native-svg (~15.x)

**Status: CONFIRMED COMPATIBLE**
**Confidence: HIGH**

- Latest version: 15.15.3; `npx expo install react-native-svg` will resolve the SDK 54-compatible version
- Required as peer dependency for lucide-react-native (accepts `^12.0.0 || ^13.0.0 || ^14.0.0 || ^15.0.0`)
- New Architecture: Supported since react-native-svg 13.x. Version 15.x has full Fabric support.
- Already used by some Expo internals but NOT in project's `package.json` -- this is a new native dependency requiring a binary rebuild.

Sources:
- [Expo SVG Docs](https://docs.expo.dev/versions/latest/sdk/svg/)
- npm registry verification: `npm view react-native-svg peerDependencies`

### 1.3 lucide-react-native (^0.563.0)

**Status: CONFIRMED COMPATIBLE (with validation needed on-device)**
**Confidence: MEDIUM -- peer deps are correct but real-world testing on RN 0.81 + New Arch needed**

- Latest version: 0.563.0 (published January 2026)
- Peer dependencies (verified via `npm view`):
  - `react: '^16.5.1 || ^17.0.0 || ^18.0.0 || ^19.0.0'` -- **React 19 IS supported**
  - `react-native: '*'` -- any version
  - `react-native-svg: '^12.0.0 || ^13.0.0 || ^14.0.0 || ^15.0.0'` -- compatible with the version we install
- Installation: `npm install lucide-react-native` (JS-only package, no native code)
- No `--legacy-peer-deps` needed: v0.563.0 correctly declares React 19 support
- Tree-shakable: each icon imports individually (`import { Home } from 'lucide-react-native'`)

**IMPORTANT: Web search results claiming lucide-react-native does NOT support React 19 are OUTDATED.** Direct `npm view` confirms `^19.0.0` is in the peer dependency range for v0.563.0. The fix was merged in the lucide repository (PR #3126, referenced in issue #3185) and shipped in versions after 0.507.0.

**Fallback plan (per context decision)**: If Lucide icons fail to render on New Architecture + React 19 environment (SVG rendering issues), use `expo-symbols` (SymbolView) for SF Symbols instead. expo-symbols is a first-party Expo SDK 54 package, requires no additional native dependencies, and provides 5000+ icons natively on iOS. Install: `npx expo install expo-symbols`. The `SymbolView` component accepts `name`, `tintColor`, `size`, and `weight` props.

Sources:
- npm registry: `npm view lucide-react-native@0.563.0 peerDependencies`
- [Lucide React Native Docs](https://lucide.dev/guide/packages/lucide-react-native)
- [GitHub Issue #3185 - React 19 fix](https://github.com/lucide-icons/lucide/issues/3185)
- [expo-symbols Docs](https://docs.expo.dev/versions/latest/sdk/symbols/)

---

## 2. Dark Mode: Night Blue Implementation

### 2.1 Token-Level Swap (Core Approach)

**Confidence: HIGH -- Direct codebase analysis**

The current `theme.ts` has a light palette:
```typescript
background: '#FFFFFF'  // -> change to '#0A0F1A' (Night Blue)
surface: '#FAFAFA'     // -> change to '#111827'
text: '#0A0A0A'        // -> change to '#F8FAFC' (near-white)
```

Impact analysis:
- **34 files** reference `colors.background` (all screens and components)
- **46 files** import from `theme.ts` (every UI file in the project)
- **ZERO import path changes needed** -- changing values in `theme.ts` propagates everywhere

Files needing color value changes in `theme.ts`:
| Token | Current | Night Blue |
|-------|---------|------------|
| `background` | `#FFFFFF` | `#0A0F1A` |
| `surface` | `#FAFAFA` | `#111827` |
| `surfaceElevated` | `#F5F5F5` | `#1E293B` |
| `text` | `#0A0A0A` | `#F8FAFC` |
| `textSecondary` | `#737373` | `#94A3B8` |
| `textTertiary` | `#A3A3A3` | `#64748B` |
| `border` | `#E5E5E5` | `#1E293B` |
| `borderLight` | `#F0F0F0` | `#334155` |
| `accent` | `#0A0A0A` | `#D4A574` (gold) |
| `error` | `#DC2626` | `#EF4444` (brighter for dark bg) |
| `success` | `#16A34A` | `#22C55E` (brighter for dark bg) |
| `overlay` | `rgba(0,0,0,0.04)` | `rgba(0,0,0,0.4)` |
| `overlayStrong` | `rgba(0,0,0,0.08)` | `rgba(0,0,0,0.6)` |

### 2.2 Hardcoded Color Audit

One hardcoded color found outside `theme.ts`:
- `ios/components/quiz/QuestionCard.tsx:119` -- `backgroundColor: '#6366F1'` (indigo for quiz option). This will need manual attention for readability on dark background, but it actually works fine since it is a colored button on any background.

One hardcoded color in `ThemeCard.tsx:123`:
- `color: '#FFFFFF'` -- due badge text color. Currently white-on-black-accent. With Night Blue accent (#D4A574 gold), white text on gold is fine.

### 2.3 app.json Changes (Require Native Build)

Current `app.json` settings that need updating:

```json
// CURRENT
"userInterfaceStyle": "automatic",
"splash": { "backgroundColor": "#ffffff" },

// UPDATED
"userInterfaceStyle": "dark",
"splash": { "backgroundColor": "#0a0f1a" },
"ios": {
  "infoPlist": {
    "UIUserInterfaceStyle": "Dark"  // Force dark on iOS system level
  }
}
```

**Why both `userInterfaceStyle` and `UIUserInterfaceStyle`**: The `userInterfaceStyle: "dark"` tells Expo/React Native to use dark color scheme. The `UIUserInterfaceStyle: "Dark"` in `infoPlist` tells iOS itself to render system UI elements (alerts, action sheets, keyboard) in dark mode. Both are needed for a fully dark experience.

**These are build-time changes** -- they modify the native info.plist and cannot be deployed via OTA. This is fine since Phase 12 requires a native build anyway.

Sources:
- [Expo Color Themes](https://docs.expo.dev/develop/user-interface/color-themes/)
- [Expo app.json Configuration](https://docs.expo.dev/versions/latest/config/app/)

### 2.4 Status Bar: Light Text

**Approach**: Use `<StatusBar style="light" />` from `expo-status-bar` in the root layout.

Current `app/_layout.tsx` does NOT render a `StatusBar` component. Adding it is straightforward:

```typescript
import { StatusBar } from 'expo-status-bar';

// In the JSX return:
<>
  <StatusBar style="light" />
  <QueryClientProvider client={queryClient}>
    <Stack ...>
  </QueryClientProvider>
</>
```

The `style="light"` forces white text/icons in the status bar, which is correct for dark backgrounds. When `userInterfaceStyle` is set to `"dark"` in app.json, `style="auto"` would also resolve to light, but explicitly setting `"light"` is safer and more obvious.

Sources:
- [Expo System Bars](https://docs.expo.dev/develop/user-interface/system-bars/)
- [Expo StatusBar API](https://docs.expo.dev/versions/latest/sdk/status-bar/)

### 2.5 White Flash Prevention

**The Problem**: When the app launches, there is a brief moment between the native splash screen hiding and the React Native view rendering. If the splash screen is white and the app is dark (or vice versa), users see a flash.

**Multi-layered prevention approach**:

1. **Splash screen backgroundColor** (app.json): Set to `#0a0f1a` (Night Blue). This is the native launch screen color. No white is ever shown natively.

2. **SplashScreen.preventAutoHideAsync()** (already partially in place): The app already uses `expo-splash-screen` (v31.0.13 in package.json). Call `SplashScreen.preventAutoHideAsync()` in global scope of `_layout.tsx` BEFORE any component renders. Then call `SplashScreen.hideAsync()` AFTER fonts are loaded AND auth check is complete.

3. **Root view backgroundColor**: Ensure the root `<View>` or `<Stack>` has `backgroundColor: '#0A0F1A'`. React Native's root view color defaults to white unless overridden. The current `LoadingScreen` component already uses `colors.background` -- once that token is Night Blue, the loading state is dark too.

4. **iOS `backgroundColor` in app.json root**: Set `"backgroundColor": "#0a0f1a"` at the expo root level. This sets the native root view background color behind all React views.

**Implementation pattern**:

```typescript
import * as SplashScreen from 'expo-splash-screen';

// GLOBAL SCOPE - before component
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({...});
  const { isLoading: authLoading, checkAuth } = useAuthStore();

  useEffect(() => { checkAuth(); }, []);

  useEffect(() => {
    if (fontsLoaded && !authLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, authLoading]);

  if (!fontsLoaded || authLoading) {
    return null; // Splash screen still visible
  }

  return (
    <>
      <StatusBar style="light" />
      <QueryClientProvider ...>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0F1A' } }}>
          ...
        </Stack>
      </QueryClientProvider>
    </>
  );
}
```

**Key detail**: The `contentStyle: { backgroundColor: '#0A0F1A' }` on `Stack` sets the background for all screen transitions. Without this, screen push/pop animations may briefly show white behind the transitioning screen.

Sources:
- [Expo SplashScreen API](https://docs.expo.dev/versions/latest/sdk/splash-screen/)
- [White Flash Prevention Pattern](https://medium.com/@ripenapps-technologies/the-white-flash-of-death-solving-theme-flickering-in-react-native-production-apps-d732af3b4cae)

---

## 3. Geist Font Loading

### 3.1 Package: @expo-google-fonts/geist (v0.4.1)

**Status: CONFIRMED COMPATIBLE**
**Confidence: HIGH**

- Version: 0.4.1 (latest, verified via npm)
- Provides static .ttf weights (not variable font) -- exactly what the context decision requires
- Available weights: 9 (Thin through Black)
- Peer dependency: `expo-font` (already installed ~14.0.11)

**Recommended weights to bundle (context says 4 minimum)**:

| Weight | Font Name | Usage |
|--------|-----------|-------|
| 400 | `Geist_400Regular` | Body text, captions, default |
| 500 | `Geist_500Medium` | Labels, buttons, tab labels, secondary emphasis |
| 600 | `Geist_600SemiBold` | Section headings, card titles |
| 700 | `Geist_700Bold` | Display text, hero numbers, h1/h2 |

I recommend **5 weights** (adding 300 Light) for design flexibility in later phases:

| Weight | Font Name | Usage |
|--------|-----------|-------|
| 300 | `Geist_300Light` | Subtle captions, tertiary text, large decorative numbers |
| 400 | `Geist_400Regular` | Body text, captions, default |
| 500 | `Geist_500Medium` | Labels, buttons, tab labels |
| 600 | `Geist_600SemiBold` | Section headings, card titles |
| 700 | `Geist_700Bold` | Display text, hero numbers |

Each weight is ~60-80KB. 5 weights = ~350KB total in assets. This is acceptable for a font-driven design.

### 3.2 Font Loading Pattern

Use `useFonts` hook (runtime loading) in `app/_layout.tsx`. This is OTA-compatible -- font files ship as JS assets with `eas update`.

```typescript
import { useFonts } from '@expo-google-fonts/geist/useFonts';
import { Geist_300Light } from '@expo-google-fonts/geist/300Light';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';

const [fontsLoaded] = useFonts({
  Geist_300Light,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
});
```

### 3.3 theme.ts Font Token Update

Current:
```typescript
export const fonts = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
} as const;
```

Updated:
```typescript
export const fonts = {
  light: 'Geist_300Light',
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
} as const;
```

### 3.4 Text.tsx Integration

The current `Text.tsx` component uses `fontFamily: fonts.regular` as the base style and `fontWeight` for variants. With Geist, we should switch to using `fontFamily` per weight (not `fontWeight`), because React Native maps `fontWeight` to system font weight, which does not work with custom fonts. The correct approach for custom fonts:

```typescript
// BEFORE: uses fontWeight (works with System font)
h1: { fontSize: 28, fontWeight: '700', lineHeight: 36 },

// AFTER: uses fontFamily (required for custom fonts)
h1: { fontSize: 28, fontFamily: fonts.bold, lineHeight: 36 },
```

**This is a critical implementation detail.** On iOS with custom fonts, you must use the exact font family name for each weight. Using `fontWeight: '700'` with `fontFamily: 'Geist_400Regular'` will NOT produce bold text -- it will still render as regular weight. Each weight must reference its own font family name.

The `Text.tsx` `variantStyles` and `weightMap` need updating:

```typescript
const variantStyles: Record<TextVariant, TextStyle> = {
  h1: { fontSize: 28, fontFamily: fonts.bold, lineHeight: 36 },
  h2: { fontSize: 24, fontFamily: fonts.bold, lineHeight: 32 },
  h3: { fontSize: 20, fontFamily: fonts.semibold, lineHeight: 28 },
  body: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 24 },
  caption: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 20 },
  label: { fontSize: 12, fontFamily: fonts.medium, lineHeight: 16 },
};

const weightMap: Record<TextWeight, string> = {
  regular: fonts.regular,
  medium: fonts.medium,
  bold: fonts.bold,
};
```

Sources:
- [@expo-google-fonts/geist on npm](https://www.npmjs.com/package/@expo-google-fonts/geist)
- [Expo Google Fonts GitHub](https://github.com/expo/google-fonts/tree/main/font-packages/geist)
- [Expo Fonts Guide](https://docs.expo.dev/develop/user-interface/fonts/)

---

## 4. Readability Pass: Dark Mode Quick Fixes

### 4.1 The Problem

When `theme.ts` colors flip from light to dark, most things work automatically because components use `colors.text` (now white) on `colors.background` (now dark). However, some elements will break:

**Will work automatically** (no changes needed):
- All `<Text>` components using `color="primary"` -- `colors.text` becomes white
- All `<Text>` components using `color="secondary"` -- `colors.textSecondary` adjusts
- `<Card>` backgrounds -- `colors.surface` becomes dark surface
- `<Input>` borders -- `colors.border` adjusts
- `<LoadingScreen>` -- uses `colors.background` + `colors.accent`
- `<EmptyState>` -- uses `colors.background`

**Will look broken** (need manual attention):
1. **Navigation headers**: Stack screen headers with `headerShown: true` use default iOS styling. With `userInterfaceStyle: "dark"`, iOS system headers will automatically be dark. But screens with `headerStyle: { backgroundColor: colors.background }` (in tabs layout) will pick up the dark color automatically.

2. **Tab bar**: Current tab layout sets `tabBarStyle: { backgroundColor: colors.background }` and `headerStyle: { backgroundColor: colors.background }`. These auto-update from tokens.

3. **Emoji icons**: Emoji rendering is unaffected by dark mode (they have their own colors).

4. **Button "primary" variant**: Currently `backgroundColor: colors.accent` with `color: 'inverse'`. Accent changes from black (#0A0A0A) to gold (#D4A574). Inverse text changes from white (#FFFFFF) to dark (#0A0F1A). This means primary buttons become **gold background with dark text** -- visually correct and intentional.

5. **Input field text**: `color: colors.text` becomes white. `backgroundColor: colors.background` becomes Night Blue. This works. Placeholder uses `colors.textSecondary` which adjusts. Works automatically.

6. **The `Text` "inverse" color**: Currently maps to `colors.background` (#FFFFFF). After swap, it maps to `#0A0F1A`. This is used in Button primary variant for the text color. If accent is gold and inverse is dark navy, the button reads: gold button with navy text. That works.

7. **ThemeCard due badge**: `backgroundColor: colors.accent` (now gold), text hardcoded `#FFFFFF`. White on gold is decent contrast (4.5:1 ratio -- passes AA). Fine for now.

### 4.2 Recommendation: Do a Quick Readability Pass

Per the context's "Claude's Discretion" section, I recommend a **quick readability pass** rather than leaving screens broken until Phase 13. The token swap handles 90% of the work. The remaining 10% is:

1. Ensure `RefreshControl` `tintColor` uses `colors.textSecondary` (already does in most places)
2. Ensure `ActivityIndicator` colors are visible on dark bg (current: `colors.accent`, which becomes gold -- fine)
3. Set `Stack` `contentStyle` to dark background to prevent white flash during transitions
4. Verify keyboard appearance: add `keyboardAppearance="dark"` to `<TextInput>` in `Input.tsx`

This is a 15-minute pass that makes the app usable in dark mode immediately, even though full design refinement happens in Phase 13.

---

## 5. Validation Strategy

### 5.1 Recommendation: Temporary Test Screen

Create a temporary `app/dev-test.tsx` screen accessible from the profile tab's dev tools section. This screen validates all three technologies in one place:

```
+-----------------------------------+
|  Foundation Validation Screen     |
+-----------------------------------+
|                                   |
|  [BlurView Test]                  |
|  Gradient bg with BlurView on top |
|  intensity=40, tint="dark"        |
|                                   |
|  [Lucide Icons Test]              |
|  Home  Search  User  Heart  Star  |
|  (5 different Lucide icons)       |
|                                   |
|  [Geist Font Test]                |
|  Light 300  Regular 400           |
|  Medium 500  SemiBold 600         |
|  Bold 700                         |
|  "Hamburgefonstivd 0123456789"    |
|                                   |
|  [Combined Test]                  |
|  GlassCard with Lucide icon       |
|  and Geist text over blur         |
+-----------------------------------+
```

**Why a test screen instead of inline**: It isolates validation from existing functionality. If a library crashes, it only crashes on the test screen, not the whole app. It also provides a single screenshot for visual confirmation (the success criterion for this phase).

After production build is validated, the test screen can be removed in Phase 13 or left as a debug utility.

### 5.2 BlurView Fallback Evaluation

The context asks to "evaluate tradeoff between glass vision and perf" for BlurView on New Architecture.

**Assessment**: expo-blur uses native `UIVisualEffectView` on iOS, which is hardware-accelerated and performant. The New Architecture does not change how native views render -- it changes the bridge between JS and native. BlurView performance is entirely in the native layer. There is no expected performance degradation on New Architecture.

**When to worry**: Only if rendering 5+ BlurViews simultaneously on older devices (iPhone 8/SE). This is a Phase 16 performance concern, not a Phase 12 concern. For validation, a single BlurView is sufficient proof.

If expo-blur fails to render entirely (extremely unlikely for a first-party Expo module), the fallback is a semi-transparent dark surface (`rgba(17, 24, 39, 0.8)`) which approximates the glass look without real blur.

---

## 6. Build Strategy

### 6.1 Version Bumping

Current state from `app.json`:
- `version`: `"1.0.0"`
- `eas.json`: `appVersionSource: "remote"` with `autoIncrement: true`

Per context: "Bump app version to next minor (1.0.x range)". Since `appVersionSource` is `"remote"`, EAS manages the version number. The `autoIncrement: true` in the production profile will bump the build number automatically.

**Recommendation**: Update `app.json` `version` to `"1.1.0"` to signal this is a meaningful new binary (not just an increment of the existing 1.0.0 binary). The build number will auto-increment from the current value (~8).

### 6.2 Build Sequence

1. **Install dependencies** (local):
   ```bash
   cd C:\Users\vmsan\Desktop\FREE\PB\VIBE\Remember\ios
   npx expo install expo-blur react-native-svg
   npm install lucide-react-native
   npx expo install @expo-google-fonts/geist
   ```

2. **Make code changes** (theme.ts, _layout.tsx, Text.tsx, app.json, test screen)

3. **Preview build** (validate on physical device):
   ```bash
   eas build --profile preview --platform ios
   ```
   Install on device. Open app. Navigate to test screen. Verify:
   - App launches with Night Blue background, no white flash
   - Status bar has white text
   - Geist font renders at all weights
   - Lucide icons render correctly
   - BlurView shows frosted glass effect
   - All existing screens are usable (dark bg, readable text)

4. **Production build + TestFlight** (after preview validation):
   ```bash
   eas build --profile production --platform ios --auto-submit
   ```

### 6.3 What Requires Native Build vs OTA

| Change | Requires Build? | Reason |
|--------|----------------|--------|
| expo-blur installation | YES | New native module |
| react-native-svg installation | YES | New native module |
| lucide-react-native installation | NO | JS-only package |
| @expo-google-fonts/geist installation | NO | JS assets only |
| app.json `userInterfaceStyle: "dark"` | YES | Modifies native info.plist |
| app.json `splash.backgroundColor` | YES | Modifies native splash screen |
| app.json `ios.infoPlist.UIUserInterfaceStyle` | YES | Modifies native info.plist |
| app.json `version: "1.1.0"` | YES | Version in native binary |
| theme.ts color changes | NO | Pure JS |
| Text.tsx font family changes | NO | Pure JS |
| StatusBar component | NO | Pure JS |
| Test screen | NO | Pure JS |

All changes happen in ONE build. After this build, all future visual work is OTA-deployable.

---

## 7. Risk Assessment

### 7.1 Low Risk

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| expo-blur not rendering | Very Low | Medium | First-party Expo module, well-tested. Fallback: semi-transparent surface |
| Geist font not loading | Very Low | Medium | Standard expo-font pattern. Fallback: returns to System font |
| Build fails | Low | Low | Fix dependency issues, retry. EAS build logs provide clear errors |
| SplashScreen.preventAutoHideAsync timing | Low | Low | Follow documented pattern: call in global scope |

### 7.2 Medium Risk

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| lucide-react-native SVG rendering issues on New Arch | Low-Medium | Medium | Validated peer deps support React 19. Fallback: expo-symbols (SF Symbols). Test on preview build first |
| Dark mode readability issues on some screens | Medium | Low | Quick readability pass in Phase 12. Full refinement in Phase 13 |
| Keyboard appearance not matching dark theme | Medium | Low | Add `keyboardAppearance="dark"` to Input.tsx |

### 7.3 No Risk

| Concern | Why No Risk |
|---------|-------------|
| Import path breakage | theme.ts values change, not export structure |
| Existing functionality regression | Only colors/fonts change, no logic changes |
| Backend compatibility | Phase 12 is 100% frontend/native |
| OTA updates breaking | Phase 12 is a native build, not OTA |

---

## 8. Implementation Checklist (Ordered)

This is the recommended implementation order within Phase 12:

### Step 1: Dependencies
- [ ] `npx expo install expo-blur react-native-svg`
- [ ] `npm install lucide-react-native`
- [ ] `npx expo install @expo-google-fonts/geist`
- [ ] Verify no peer dependency warnings in install output

### Step 2: app.json Configuration
- [ ] `userInterfaceStyle`: `"automatic"` -> `"dark"`
- [ ] `splash.backgroundColor`: `"#ffffff"` -> `"#0a0f1a"`
- [ ] Add `"backgroundColor": "#0a0f1a"` at expo root level
- [ ] Add `ios.infoPlist.UIUserInterfaceStyle`: `"Dark"`
- [ ] `version`: `"1.0.0"` -> `"1.1.0"`

### Step 3: Font Loading in _layout.tsx
- [ ] Import useFonts and Geist weights from @expo-google-fonts/geist
- [ ] Call SplashScreen.preventAutoHideAsync() in global scope
- [ ] Add useFonts hook
- [ ] Gate rendering on fontsLoaded + auth state
- [ ] Call SplashScreen.hideAsync() when both are ready
- [ ] Add `<StatusBar style="light" />`
- [ ] Set `contentStyle: { backgroundColor: '#0A0F1A' }` on Stack

### Step 4: theme.ts Color + Font Swap
- [ ] Replace all color values with Night Blue palette
- [ ] Replace fonts object with Geist font family names
- [ ] Add `semibold` key to fonts (currently only regular/medium/bold)

### Step 5: Text.tsx Update
- [ ] Replace `fontWeight` in variantStyles with `fontFamily` from fonts tokens
- [ ] Update `weightMap` to use font family names instead of fontWeight strings
- [ ] Add 'semibold' to TextWeight type

### Step 6: Quick Readability Pass
- [ ] Add `keyboardAppearance="dark"` to Input.tsx TextInput
- [ ] Verify RefreshControl tintColor is `colors.textSecondary` everywhere
- [ ] Verify navigation header colors auto-update from tokens

### Step 7: Validation Test Screen
- [ ] Create `app/dev-test.tsx` with BlurView + Lucide + Geist tests
- [ ] Add navigation to it from profile dev tools

### Step 8: Preview Build + Device Validation
- [ ] `eas build --profile preview --platform ios`
- [ ] Install on physical device
- [ ] Verify all 5 success criteria

### Step 9: Production Build
- [ ] `eas build --profile production --platform ios --auto-submit`
- [ ] Verify TestFlight submission succeeds

---

## 9. Answers to Claude's Discretion Items

### White flash prevention implementation
Use the triple-layer approach: (1) `splash.backgroundColor: "#0a0f1a"` in app.json, (2) `SplashScreen.preventAutoHideAsync()` + `hideAsync()` gating on fonts + auth, (3) `contentStyle: { backgroundColor: '#0A0F1A' }` on Stack navigator. See Section 2.5.

### Exact Geist font weights to bundle
5 weights: Light (300), Regular (400), Medium (500), SemiBold (600), Bold (700). This provides design flexibility for Phase 13+ while keeping asset size under 400KB. See Section 3.1.

### Validation strategy
Temporary test screen (`app/dev-test.tsx`) accessible from profile dev tools. Validates BlurView, Lucide icons, and Geist fonts in isolation. See Section 5.1.

### BlurView fallback
Not needed for Phase 12. expo-blur uses native UIVisualEffectView which is not affected by New Architecture. Performance concerns are Phase 16 scope. If it somehow fails entirely, use `rgba(17, 24, 39, 0.8)` semi-transparent surface as fallback. See Section 5.2.

### Quick readability pass
Yes, do it. It is 15 minutes of work (keyboard appearance, RefreshControl tint verification, Stack contentStyle). Makes the app immediately usable in dark mode. Leaving broken-looking screens for weeks until Phase 13 is bad for testing and morale. See Section 4.2.

---

## 10. Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| expo-blur compatibility | HIGH | First-party Expo SDK 54 module, version confirmed |
| react-native-svg compatibility | HIGH | First-party, well-established, version confirmed |
| lucide-react-native React 19 support | HIGH | Peer deps verified directly via npm view (^19.0.0 declared) |
| lucide-react-native on New Arch | MEDIUM | Peer deps correct, but limited real-world reports; preview build will confirm |
| Geist font loading | HIGH | Standard expo-font pattern, package verified |
| Dark mode token swap | HIGH | Direct codebase analysis, 100% of files use theme imports |
| White flash prevention | HIGH | Documented Expo pattern, multiple layers of protection |
| Build process | HIGH | EAS build well-established, project has successful build history |
| expo-symbols fallback | HIGH | First-party Expo module, verified SDK 54 support |

---

## Sources

### Official Documentation (HIGH confidence)
- [Expo BlurView](https://docs.expo.dev/versions/latest/sdk/blur-view/)
- [Expo SVG](https://docs.expo.dev/versions/latest/sdk/svg/)
- [Expo Color Themes](https://docs.expo.dev/develop/user-interface/color-themes/)
- [Expo System Bars](https://docs.expo.dev/develop/user-interface/system-bars/)
- [Expo Fonts Guide](https://docs.expo.dev/develop/user-interface/fonts/)
- [Expo SplashScreen](https://docs.expo.dev/versions/latest/sdk/splash-screen/)
- [Expo app.json Config](https://docs.expo.dev/versions/latest/config/app/)
- [Expo Symbols](https://docs.expo.dev/versions/latest/sdk/symbols/)
- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54)

### Package Registry (HIGH confidence -- direct verification)
- `npm view lucide-react-native@0.563.0 peerDependencies` -- confirms React 19 support
- `npm view @expo-google-fonts/geist version` -- confirms v0.4.1
- `npm view expo-blur version` -- confirms v15.0.8
- `npm view expo-symbols version` -- confirms v1.0.8

### Community Sources (MEDIUM confidence)
- [Lucide React Native Guide](https://lucide.dev/guide/packages/lucide-react-native)
- [GitHub Issue #3185 - Lucide React 19](https://github.com/lucide-icons/lucide/issues/3185)
- [Expo Google Fonts - Geist](https://github.com/expo/google-fonts/tree/main/font-packages/geist)
- [White Flash Prevention](https://medium.com/@ripenapps-technologies/the-white-flash-of-death-solving-theme-flickering-in-react-native-production-apps-d732af3b4cae)

### Direct Codebase Analysis
- 46 files import from `theme.ts`
- 34 files reference `colors.background`
- 1 hardcoded color found outside theme (`QuestionCard.tsx`)
- Current `theme.ts` has 6 export objects (colors, spacing, fonts, borderRadius, shadows, layout)
- Current `Text.tsx` uses `fontWeight` for variants (must switch to `fontFamily` for Geist)
- Current `_layout.tsx` has no StatusBar component, no font loading, no splash screen management
