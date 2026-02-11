# Phase 13: Design System - Research

**Researched:** 2026-02-11
**Domain:** React Native Design System (Glass UI, Night Blue palette, Lucide icons, Expo SDK 54)
**Confidence:** HIGH

## Summary

Phase 13 transforms the existing Ankora app from its current flat Night Blue dark-mode look into a premium Glass UI design system. The foundation is already solid: Phase 12 installed all native dependencies (expo-blur, lucide-react-native, react-native-svg, @expo-google-fonts/geist), established the Night Blue color palette in `theme.ts`, and validated on-device rendering via TestFlight. The primary work is: (1) tuning BlurView for a visible frosted glass effect (it renders but frost was not visible at intensity=40), (2) building Glass component primitives, (3) replacing all emoji with Lucide icons, (4) restyling the existing 8 UI primitives, and (5) converting the tab bar to a glass blur background.

The codebase has 8 UI primitives (Text, Button, Card, Input, Badge, TopicChip, Skeleton, Toast), 5 content components (ContentCard, FilterBar, SourcePills, SelectionBar, TriageActions), 4 standalone components (ThemeCard, DiscoveryThemeCard, EmptyState, ErrorState, LoadingScreen, TopicEditModal), 4 tab screens, and ~12 stack screens. Emoji usage is pervasive: tab icons use emoji (4 locations), source indicators use emoji (repeated in 8+ files), and several screen states use emoji (quiz results, empty states, error states). The QuestionCard component has hardcoded light-mode colors (#DCFCE7, #FEE2E2, #F5F5F5, #E5E5E5, #000000) that must be converted to Night Blue tokens.

**Primary recommendation:** Build Glass components as standalone wrappers around BlurView (not as modifications to existing components), use `systemThinMaterialDark` or `systemChromeMaterialDark` tint for native iOS glass feel, and create thin Icon/TabIcon/PlatformIcon wrappers around Lucide for consistent sizing and platform icon fallbacks (since Lucide deprecated brand icons).

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-blur | ~15.0.8 | BlurView for glass surfaces | Official Expo package, uses native iOS UIVisualEffectView |
| lucide-react-native | ^0.563.0 | SVG icon library (1500+ icons) | Tree-shakeable, consistent design, React Native SVG-based |
| react-native-svg | 15.12.1 | SVG rendering (Lucide dependency) | Required by lucide-react-native |
| @expo-google-fonts/geist | ^0.4.1 | Geist font family (5 weights) | Already loaded in root layout |
| react-native-reanimated | ~4.1.1 | Animations (opacity wrappers for blur) | Already installed, New Arch compatible |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-navigation/bottom-tabs | (via expo-router) | Tab bar customization | Glass tab bar via `tabBarBackground` |
| expo-haptics | ~15.0.8 | Haptic feedback | Button press feedback (Phase 16 scope, but available) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| expo-blur BlurView | expo-glass-effect GlassView | GlassView requires iOS 26+ and expo-glass-effect install; BlurView works on current iOS versions and is already installed |
| lucide-react-native | @expo/vector-icons | @expo/vector-icons has larger bundle, less consistent design; Lucide already installed and validated |
| Custom Glass components | react-native-blur (community) | expo-blur is official and already installed; community lib adds maintenance burden |

**Installation:** No new packages needed -- all dependencies are already installed from Phase 12.

## Architecture Patterns

### Recommended Project Structure
```
ios/
├── theme.ts                          # Existing -- add glass tokens here
├── components/
│   ├── ui/
│   │   ├── Text.tsx                  # Existing -- restyle
│   │   ├── Button.tsx                # Existing -- restyle + fix style prop
│   │   ├── Card.tsx                  # Existing -- restyle
│   │   ├── Input.tsx                 # Existing -- restyle
│   │   ├── Badge.tsx                 # Existing -- restyle
│   │   ├── TopicChip.tsx             # Existing -- restyle
│   │   ├── Skeleton.tsx              # Existing -- restyle
│   │   ├── Toast.tsx                 # Existing -- restyle
│   │   └── index.ts                  # Existing -- add new exports
│   ├── glass/
│   │   ├── GlassSurface.tsx          # NEW -- base blur container
│   │   ├── GlassCard.tsx             # NEW -- card with glass background
│   │   ├── GlassButton.tsx           # NEW -- button with glass background
│   │   ├── GlassInput.tsx            # NEW -- input with glass background
│   │   └── index.ts                  # NEW -- barrel export
│   └── icons/
│       ├── Icon.tsx                  # NEW -- thin Lucide wrapper (size/color defaults)
│       ├── TabIcon.tsx               # NEW -- tab bar icon wrapper
│       ├── PlatformIcon.tsx          # NEW -- YouTube/Spotify/TikTok/Instagram icons
│       └── index.ts                  # NEW -- barrel export
```

### Pattern 1: GlassSurface Base Component
**What:** A reusable wrapper around BlurView that provides the standard glass appearance (blur + semi-transparent border + shadow).
**When to use:** Any surface that needs the frosted glass effect.
**Example:**
```typescript
// Source: expo-blur docs + Phase 12 findings
import { BlurView } from 'expo-blur';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, borderRadius } from '../../theme';

interface GlassSurfaceProps {
  children: React.ReactNode;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  radius?: keyof typeof borderRadius;
}

export function GlassSurface({
  children,
  intensity = 60,
  style,
  radius = 'lg',
}: GlassSurfaceProps) {
  return (
    <View style={[
      styles.container,
      { borderRadius: borderRadius[radius] },
      style,
    ]}>
      <BlurView
        intensity={intensity}
        tint="systemThinMaterialDark"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  content: {
    // Content sits on top of blur
  },
});
```

### Pattern 2: Glass Tab Bar via tabBarBackground
**What:** Replace solid tab bar background with BlurView + absolute positioning.
**When to use:** The `(tabs)/_layout.tsx` file.
**Example:**
```typescript
// Source: expo-router docs + react-navigation bottom-tab-navigator docs
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: 'transparent',
        },
        tabBarBackground: () => (
          <BlurView
            intensity={80}
            tint="systemChromeMaterialDark"
            style={StyleSheet.absoluteFill}
          />
        ),
      }}
    >
      {/* ... */}
    </Tabs>
  );
}
```

### Pattern 3: Icon Wrapper with Defaults
**What:** Thin wrapper around Lucide icons that provides app-level defaults for size and color.
**When to use:** Everywhere icons are rendered.
**Example:**
```typescript
// Source: lucide-react-native docs
import { LucideIcon } from 'lucide-react-native';
import { colors } from '../../theme';

interface IconProps {
  icon: LucideIcon;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({
  icon: LucideIconComponent,
  size = 24,
  color = colors.text,
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <LucideIconComponent
      size={size}
      color={color}
      strokeWidth={strokeWidth}
    />
  );
}
```

### Pattern 4: PlatformIcon for Source Indicators
**What:** Since Lucide deprecated brand icons (Instagram deprecated in v0.475.0, YouTube/Spotify/TikTok never existed), use generic Lucide icons as platform indicators.
**When to use:** Anywhere `sourceEmoji` or `sourceIcon` maps currently appear.
**Example:**
```typescript
// Source: lucide.dev/icons, lucide-icons/lucide#2792
import { Play, Headphones, Music, Camera } from 'lucide-react-native';
import { colors } from '../../theme';

const PLATFORM_ICONS = {
  youtube: Play,
  spotify: Headphones,
  tiktok: Music,
  instagram: Camera,
} as const;

interface PlatformIconProps {
  platform: keyof typeof PLATFORM_ICONS;
  size?: number;
  color?: string;
}

export function PlatformIcon({
  platform,
  size = 18,
  color = colors.textSecondary,
}: PlatformIconProps) {
  const IconComponent = PLATFORM_ICONS[platform];
  return <IconComponent size={size} color={color} strokeWidth={1.75} />;
}
```

### Pattern 5: Night Blue Token Extension for Glass
**What:** Add glass-specific tokens to the existing theme.ts.
**When to use:** When defining the glass design tokens.
**Example:**
```typescript
// Added to theme.ts
export const glass = {
  // Border colors for glass surfaces
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.12)',
  borderFocused: 'rgba(212, 165, 116, 0.3)', // accent-tinted

  // Background fills for non-blur glass (fallback)
  fill: 'rgba(17, 24, 39, 0.6)',          // surface with alpha
  fillElevated: 'rgba(30, 41, 59, 0.5)',  // surfaceElevated with alpha

  // Shadows
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },

  // BlurView defaults
  intensity: 60,
  tint: 'systemThinMaterialDark' as const,
  tabBarTint: 'systemChromeMaterialDark' as const,
  tabBarIntensity: 80,
} as const;
```

### Anti-Patterns to Avoid
- **Modifying existing components destructively:** Glass components should be NEW components (GlassSurface, GlassCard), not replacements for existing Card/Button. Existing components get restyled with Night Blue tokens, but Glass variants are separate.
- **Importing all Lucide icons dynamically:** Using `import * as icons from 'lucide-react-native/icons'` destroys tree-shaking. Always import specific icons by name.
- **Using `intensity={100}` everywhere:** High intensity creates an opaque white wash on dark backgrounds. Start at 40-60 and increase from there. The `systemThinMaterialDark` tint automatically handles dark-appropriate blurring.
- **Setting backgroundColor on BlurView:** The blur effect needs to see-through the view. Setting backgroundColor on BlurView itself blocks the blur. Use backgroundColor on a wrapper or sibling view if needed.
- **Ignoring `useBottomTabBarHeight` for glass tab bar:** When tab bar is `position: 'absolute'`, content will render behind it. Every scrollable screen in tabs must add bottom padding equal to the tab bar height.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blur/frost effect | Custom blur shader | expo-blur BlurView with `systemThinMaterialDark` tint | Uses native iOS UIVisualEffectView which handles frosted glass natively |
| Icon rendering | Custom SVG components | lucide-react-native | 1500+ icons, tree-shakeable, consistent stroke width |
| Tab bar background | Custom absolute-positioned view | `tabBarBackground` prop from @react-navigation/bottom-tabs | Native integration with tab bar layout, handles height/positioning |
| Tab bar height measurement | Manual height calculation | `useBottomTabBarHeight()` from @react-navigation/bottom-tabs | Accurately reads native tab bar height including safe area |
| Dark mode colors for quiz options | Hardcoded hex values | Theme tokens from `theme.ts` | Centralized, consistent, maintainable |

**Key insight:** Glass UI in React Native is fundamentally about layering BlurView over content, not custom shader magic. The iOS platform provides native visual effect views that handle blur natively -- expo-blur wraps these. The planner should NOT create tasks that implement custom blur algorithms.

## Common Pitfalls

### Pitfall 1: BlurView Not Showing Visible Frost (KNOWN ISSUE)
**What goes wrong:** BlurView renders as a component (no crash) but produces no visible blur/frost effect.
**Why it happens:** At `intensity=40` with `tint="dark"`, the dark tint already darkens the view so much that the blur is not perceptible against a dark background. Phase 12 confirmed this on-device.
**How to avoid:**
1. Use iOS system material tints (`systemThinMaterialDark`, `systemChromeMaterialDark`) instead of basic `"dark"` tint -- these are designed for layered glass effects
2. Increase intensity to 60-80 range
3. Ensure there is visible content BEHIND the BlurView (colored gradients, images) -- blur is only visible when there's something to blur
4. For the tab bar specifically, content scrolling behind creates the blur effect naturally
**Warning signs:** Glass components look like solid dark rectangles with no depth

### Pitfall 2: Content Hidden Behind Absolute Tab Bar
**What goes wrong:** Screen content is clipped at the bottom, hidden behind the glass tab bar.
**Why it happens:** `position: 'absolute'` removes the tab bar from the layout flow.
**How to avoid:** Use `useBottomTabBarHeight()` from `@react-navigation/bottom-tabs` to add `paddingBottom` to all scrollable tab screens.
**Warning signs:** Last items in scrollable lists are unreachable

### Pitfall 3: Button.tsx Missing `style` Prop (PRE-EXISTING)
**What goes wrong:** TypeScript errors when passing `style` prop to Button component.
**Why it happens:** `ButtonProps` interface does not include `style?: StyleProp<ViewStyle>`. This was documented in Phase 12 as a pre-existing issue (5 TS errors in theme/manage, topic/manage, TopicEditModal).
**How to avoid:** Fix the ButtonProps interface as part of the restyle task -- add `style?: StyleProp<ViewStyle>` to ButtonProps.
**Warning signs:** TS errors on any `<Button style={...}>` usage

### Pitfall 4: Lucide Brand Icons Deprecated
**What goes wrong:** Importing `Instagram`, `Youtube`, etc. from lucide-react-native triggers deprecation warnings or doesn't exist.
**Why it happens:** Lucide deprecated all brand/logo icons as of v0.475.0 (GitHub issue #2792, #670). Instagram exists but is deprecated. YouTube, Spotify, TikTok never existed.
**How to avoid:** Use generic concept icons as platform indicators: `Play` (YouTube), `Headphones` (Spotify), `Music` (TikTok), `Camera` (Instagram). Wrap in a `PlatformIcon` component for centralized mapping.
**Warning signs:** Missing or deprecated import warnings

### Pitfall 5: fontWeight vs fontFamily for Geist
**What goes wrong:** Setting `fontWeight: '600'` produces system font, not Geist SemiBold.
**Why it happens:** React Native ignores fontWeight on custom fonts. Each weight must be referenced by its registered fontFamily name.
**How to avoid:** Already handled by Text.tsx -- use `fontFamily: fonts.semibold` not `fontWeight: '600'`. Ensure any new components or inline styles follow this pattern. Watch for `fontWeight` in ContentCard, SelectionBar, TriageActions, FilterBar, DiscoveryThemeCard, ThemeCard that bypass the Text component.
**Warning signs:** Text appears in system font (SF Pro) instead of Geist

### Pitfall 6: Hardcoded Colors in QuestionCard
**What goes wrong:** Quiz options show light-mode background colors (#DCFCE7, #FEE2E2, #F5F5F5, #E5E5E5) and borders (#16A34A, #DC2626, #000000, #E0E0E0) that clash with Night Blue dark mode.
**Why it happens:** QuestionCard was written before the dark mode migration with inline hex values, never converted to theme tokens.
**How to avoid:** Replace all hardcoded hex values in QuestionCard with theme-derived equivalents: use `colors.success` with alpha for correct answer backgrounds, `colors.error` with alpha for wrong answer backgrounds, and `colors.surfaceElevated`/`colors.surface` for default/selected states.
**Warning signs:** Quiz options appear as bright light rectangles on dark background

### Pitfall 7: Overflow Hidden Required for BlurView Border Radius
**What goes wrong:** BlurView ignores borderRadius prop, rendering as a sharp rectangle.
**Why it happens:** iOS BlurView does not respect borderRadius directly.
**How to avoid:** Always wrap BlurView in a parent View with `overflow: 'hidden'` and `borderRadius` set on the parent.
**Warning signs:** Glass components have sharp corners despite borderRadius being set

## Code Examples

### Glass Tab Bar (Critical Path)
```typescript
// Source: expo-router docs, react-navigation docs, Phase 12 findings
// File: ios/app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { House, BookOpen, Brain, User } from 'lucide-react-native';
import { colors, fonts, glass } from '../../theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: 'transparent',
        },
        tabBarBackground: () => (
          <BlurView
            intensity={glass.tabBarIntensity}
            tint={glass.tabBarTint}
            style={StyleSheet.absoluteFill}
          />
        ),
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.semibold },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => <House size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Collection',
          tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: 'Memos',
          tabBarIcon: ({ color, size }) => <Brain size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

### Night Blue Quiz Option Colors (Replace Light Mode)
```typescript
// Replace QuestionCard hardcoded colors with Night Blue equivalents
const getOptionColors = (isCorrect: boolean, isWrong: boolean, isSelected: boolean, hasResult: boolean) => ({
  backgroundColor: isCorrect && hasResult
    ? 'rgba(34, 197, 94, 0.15)'     // success with alpha (replaces #DCFCE7)
    : isWrong
    ? 'rgba(239, 68, 68, 0.15)'     // error with alpha (replaces #FEE2E2)
    : isSelected
    ? colors.surfaceElevated         // replaces #E5E5E5
    : colors.surface,                // replaces #F5F5F5
  borderColor: isCorrect && hasResult
    ? colors.success                  // replaces #16A34A
    : isWrong
    ? colors.error                    // replaces #DC2626
    : isSelected
    ? colors.text                     // replaces #000000
    : colors.borderLight,             // replaces #E0E0E0
});
```

### useBottomTabBarHeight Usage in Tab Screens
```typescript
// Every scrollable tab screen needs this when tab bar is absolute
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

export default function FeedScreen() {
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: tabBarHeight }}
    >
      {/* ... */}
    </ScrollView>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tint="dark"` with low intensity | `tint="systemThinMaterialDark"` system material tints | iOS 13+ / expo-blur | Native glass materials designed for layered UI, better dark-mode blur |
| Brand icons from icon libraries | Generic concept icons (brand icons removed) | Lucide v0.475.0 (2025) | Must map platforms to concept icons (Play, Headphones, Music, Camera) |
| expo-glass-effect GlassView | Only available iOS 26+ (unreleased) | 2025-2026 | Not usable yet; stick with expo-blur BlurView |
| fontWeight for custom fonts | fontFamily for each weight | React Native standard | Already handled in Phase 12 Text.tsx |

**Deprecated/outdated:**
- `tint="dark"` for glass surfaces: too opaque on dark backgrounds, use system material tints instead
- Lucide brand icons (Instagram, Facebook, etc.): deprecated in v0.475.0, use generic concept icons
- `expo-glass-effect`: requires iOS 26+ (not yet available to users), do not use

## Inventory: Files Requiring Changes

### Emoji Replacement Locations (DS-03)
| File | Emoji Usage | Replacement Approach |
|------|-------------|---------------------|
| `app/(tabs)/_layout.tsx` | Tab bar icons: home, grid, brain, user | Lucide: House, BookOpen, Brain, User |
| `app/(tabs)/index.tsx` | sourceEmoji map, EmptyState icon, suggestion emoji | PlatformIcon, Lucide LinkIcon, PlatformIcon |
| `app/(tabs)/reviews.tsx` | sourceEmoji map, topic emoji, content emoji | PlatformIcon, BookOpen, PlatformIcon |
| `app/(tabs)/profile.tsx` | Platform config emoji, user avatar emoji, sync emoji | PlatformIcon, User icon, PlatformIcon |
| `app/(tabs)/library.tsx` | EmptyState icons | Lucide BookOpen, Search, Sparkles |
| `app/topic/[name].tsx` | sourceEmoji, settings emoji | PlatformIcon, Settings |
| `app/theme/[id].tsx` | settings emoji | Settings |
| `app/content/[id].tsx` | sourceEmoji, thumbnail placeholder | PlatformIcon |
| `app/oauth/[platform].tsx` | Platform config emoji | PlatformIcon |
| `components/content/ContentCard.tsx` | sourceIcon map, checkmark | PlatformIcon, Check |
| `components/content/FilterBar.tsx` | Source icons (text chars), checkmark, close | PlatformIcon, Check, X |
| `components/content/SourcePills.tsx` | Source icons (text chars) | PlatformIcon |
| `components/content/TriageActions.tsx` | Check/X text chars | Lucide Check, X |
| `components/quiz/QuestionCard.tsx` | Checkmark text | Lucide Check |
| `components/quiz/QuizSummary.tsx` | Result emoji (party, thumbs, muscle) | Lucide Trophy, ThumbsUp, Dumbbell or Star |
| `components/quiz/AnswerFeedback.tsx` | Check/X in header | Lucide Check, X |
| `components/ui/Toast.tsx` | Success/error/info icons | Lucide Check, X, Info |
| `components/ErrorState.tsx` | Warning emoji | Lucide TriangleAlert |
| `components/EmptyState.tsx` | Default mailbox emoji | Lucide Inbox |
| `components/ThemeCard.tsx` | Theme emoji (from data) | Keep theme emoji (user-selected) |
| `components/DiscoveryThemeCard.tsx` | Theme emoji (from data) | Keep theme emoji (user-selected) |
| `app/theme-create.tsx` | Emoji palette selection | Keep (emoji is user-facing data) |

**Note:** Theme emoji (ThemeCard, DiscoveryThemeCard, theme-create) should be KEPT as emoji -- these are user-selected data, not UI chrome.

### Light-Mode Color Locations (DS-01)
| File | Hardcoded Colors | Fix |
|------|-----------------|-----|
| `components/quiz/QuestionCard.tsx` | #DCFCE7, #FEE2E2, #E5E5E5, #F5F5F5, #16A34A, #DC2626, #000000, #E0E0E0, #6366F1, #FFFFFF | Replace with theme tokens + alpha variants |
| `app/_layout.tsx` | #0A0F1A, #F8FAFC repeated 12x | Replace with `colors.background`, `colors.text` imports |
| `components/ThemeCard.tsx` | #FFFFFF (dueText) | Replace with `colors.text` or dedicated inverse |
| `components/content/ContentCard.tsx` | #FFFFFF (badge/duration text) | Replace with `colors.text` |
| `app/theme-discovery.tsx` | #FFFFFF (ActivityIndicator) | Replace with `colors.text` |
| `app/theme-create.tsx` | Color palette (intentional data) | Keep -- these are user-selectable theme colors |
| `app/theme/manage/[id].tsx` | Color palette (intentional data) | Keep |
| `app/dev-test.tsx` | #D4A574, #3B82F6, #1a1a3e (test screen) | Will be removed or updated as needed |

### Components Requiring Restyle (DS-04)
All 8 UI primitives already use `colors.*` from theme.ts, but need refinements:
1. **Button.tsx** -- Add `style` prop to ButtonProps (fix TS errors), verify all variants use theme tokens
2. **Card.tsx** -- Already uses `colors.surface`, may need subtle border added
3. **Input.tsx** -- Already dark-styled, verify focused border uses accent
4. **Badge.tsx** -- Good, uses `colors.accent`/`colors.error`/`colors.success`
5. **TopicChip.tsx** -- Good, uses theme tokens
6. **Skeleton.tsx** -- Uses `colors.border` for pulse -- verify visibility on dark
7. **Toast.tsx** -- Replace text icons (check/x/info) with Lucide icons
8. **Text.tsx** -- Already fully themed from Phase 12

## Open Questions

1. **BlurView Intensity Tuning**
   - What we know: `intensity=40` with `tint="dark"` produces no visible frost on TestFlight build. System material tints (`systemThinMaterialDark`) should work better.
   - What's unclear: Exact intensity value that produces the best visual result on physical device. This requires on-device experimentation.
   - Recommendation: Start with `systemThinMaterialDark` at intensity=60, test on-device, adjust. Include a tuning step in the plan as a checkpoint.

2. **Theme Emoji: Keep or Convert?**
   - What we know: Themes have user-selected emoji (from EMOJI_PALETTE in theme-create.tsx). These are data, not UI chrome.
   - What's unclear: Should the theme creation flow eventually switch to Lucide icons instead of emoji?
   - Recommendation: Keep theme emoji as-is for Phase 13. The roadmap says "no emoji remain" but this likely refers to UI chrome emoji, not user data emoji. Converting theme data is a Phase 14 (Screen Rebuild) concern if at all.

3. **GlassView vs BlurView for Future**
   - What we know: `expo-glass-effect` provides native iOS Liquid Glass but requires iOS 26+. Current users are on iOS 17-18.
   - What's unclear: When iOS 26 adoption will be high enough to use GlassView.
   - Recommendation: Use BlurView for now. Glass components could be upgraded to GlassView later as a drop-in replacement.

## Sources

### Primary (HIGH confidence)
- [expo-blur docs](https://docs.expo.dev/versions/latest/sdk/blur-view/) - BlurView API, tint options, intensity range, platform support
- [expo-router tabs docs](https://docs.expo.dev/router/advanced/tabs/) - tabBarBackground with BlurView, absolute positioning
- [react-navigation bottom-tab-navigator](https://reactnavigation.org/docs/bottom-tab-navigator/) - tabBarBackground, tabBarStyle, useBottomTabBarHeight
- [lucide-react-native guide](https://lucide.dev/guide/packages/lucide-react-native) - Installation, props, tree-shaking, Icon component
- [lucide icons browser](https://lucide.dev/icons/) - Available icon names for all concepts

### Secondary (MEDIUM confidence)
- [expo-glass-effect docs](https://docs.expo.dev/versions/latest/sdk/glass-effect/) - GlassView API (iOS 26+ only, not usable yet)
- [lucide-icons/lucide#2792](https://github.com/lucide-icons/lucide/issues/2792) - Brand icons deprecated (Instagram, Facebook, etc.)
- [expo/expo#33948](https://github.com/expo/expo/issues/33948) - BlurView Android fix via experimentalBlurMethod
- [Glassmorphism 2025 guide](https://codercrafter.in/blogs/react-native/glassmorphism-ui-design-complete-2025-guide-with-examples-code) - Glass pattern: blur + transparency + border + shadow
- [Dark Glassmorphism 2026](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f) - Dark glass pattern: subtle white tint, backdrop blur, ambient gradients

### Tertiary (LOW confidence)
- [Glassmorphic tab bar tutorial (Jan 2026)](https://medium.com/@shreechandra2378/tutorial-building-a-stunning-glassmorphic-tab-bar-in-react-native-75a15d87a975) - Community tutorial, implementation details not verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and validated on-device in Phase 12
- Architecture: HIGH - Patterns verified against official Expo and React Navigation docs
- Pitfalls: HIGH - BlurView frost issue confirmed by Phase 12 on-device testing; brand icon deprecation confirmed by GitHub issue
- Icon mapping: MEDIUM - Lucide icon name availability verified via lucide.dev; specific platform icon choices (Play/Headphones/Music/Camera) are aesthetic decisions that may need user validation

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (stable stack, no fast-moving dependencies)
