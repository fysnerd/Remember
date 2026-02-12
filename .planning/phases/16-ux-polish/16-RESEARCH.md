# Phase 16: UX Polish - Research

**Researched:** 2026-02-12
**Domain:** React Native animations, haptic feedback, micro-interactions, freemium UI patterns
**Confidence:** HIGH

## Summary

Phase 16 adds four UX polish layers to the existing Ankora app: screen transition animations, contextual loading states, freemium lock overlays, and haptic feedback. The good news is that every library needed is already installed in the project (`react-native-reanimated ~4.1.1`, `expo-haptics ~15.0.8`, `expo-blur ~15.0.8`). No new native dependencies are required, meaning all changes ship via OTA update (`eas update`).

The current codebase has **zero usage of Reanimated** (only legacy `Animated` API in `Skeleton.tsx` and `Toast.tsx`), **zero haptic feedback**, and **no freemium lock UI**. Screen transitions use expo-router's default Native Stack behavior (iOS default ~350ms slide-from-right). The approach is to add Reanimated's `entering`/`exiting` layout animations for in-screen micro-interactions, configure Native Stack `animation`/`animationDuration` for screen transitions, add `expo-haptics` calls at key interaction points, and build a `GlassLockOverlay` component for freemium indicators.

**Primary recommendation:** Use Reanimated `Animated.View` with `entering`/`exiting` predefined animations (FadeIn, SlideInRight, etc.) for in-screen element transitions. Use Native Stack's `animation` + `animationDuration` props for screen-to-screen transitions. Use `expo-haptics` for tactile feedback. Build a new `GlassLockOverlay` component using `expo-blur` + Lucide `Lock` icon. No new library installs needed.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native-reanimated | ~4.1.1 (installed) | In-screen animations: entering/exiting, animated styles, withTiming/withSpring | Only production-ready animation library for RN New Architecture. Runs on UI thread at 60fps. |
| expo-haptics | ~15.0.8 (installed) | Tactile feedback on key interactions | Expo's official haptics wrapper. Maps to UIImpactFeedbackGenerator on iOS. |
| expo-blur | ~15.0.8 (installed) | Freemium lock overlay blur effect | Already used for GlassSurface, GlassButton, tab bar. |
| lucide-react-native | ^0.563.0 (installed) | Lock icon for freemium overlay | Already used project-wide. Lock icon available. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-native-screens | ~4.16.0 (installed) | Native Stack transition animation config | Provides `animation`, `animationDuration` props via expo-router Stack |
| @react-navigation/native | ^7.1.8 (installed) | Tab bar transition configuration | Tab switch animations configured via screenOptions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reanimated entering/exiting | React Native core `Animated` API | Already used for Skeleton/Toast, but no layout animations, no entering/exiting, harder to use |
| Reanimated entering/exiting | Moti (wrapper around Reanimated) | Simpler API but extra dependency, no real benefit when using Reanimated directly |
| expo-haptics | react-native-haptics (community) | Not needed - expo-haptics already installed and sufficient |

**Installation:**
```bash
# Nothing to install - all libraries already in package.json
```

## Architecture Patterns

### Recommended Project Structure
```
ios/
├── lib/
│   ├── haptics.ts           # Haptic feedback utility (centralized)
│   └── animations.ts        # Animation presets/constants (centralized)
├── components/
│   ├── glass/
│   │   ├── GlassLockOverlay.tsx  # NEW: Freemium lock overlay on glass surfaces
│   │   └── ... (existing)
│   ├── ui/
│   │   ├── AnimatedList.tsx       # OPTIONAL: Wrapper for staggered list entry
│   │   └── ... (existing)
│   └── ...
├── app/
│   ├── _layout.tsx           # MODIFY: Add animation/animationDuration to screenOptions
│   └── (tabs)/
│       └── _layout.tsx       # MODIFY: Add haptics on tab switch
└── theme.ts                  # MODIFY: Add animation timing tokens
```

### Pattern 1: Centralized Haptic Feedback Utility
**What:** A single `haptics.ts` module that wraps `expo-haptics` with semantic function names.
**When to use:** Every time haptic feedback is needed across the app.
**Why:** Avoids scattering `import * as Haptics from 'expo-haptics'` everywhere. Single place to adjust feedback intensity or add platform checks.
**Example:**
```typescript
// ios/lib/haptics.ts
import * as Haptics from 'expo-haptics';

export const haptics = {
  /** Light tap - button press, tab switch */
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),

  /** Medium impact - card selection, toggle */
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),

  /** Selection change - filter, option pick */
  selection: () => Haptics.selectionAsync(),

  /** Success - quiz correct answer, action completed */
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),

  /** Error - quiz wrong answer, validation failure */
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),

  /** Warning - destructive action confirmation */
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};
```

### Pattern 2: Animation Timing Constants
**What:** Centralized animation duration and easing constants in theme.ts or a dedicated file.
**When to use:** Any animated component references these constants instead of magic numbers.
**Example:**
```typescript
// Addition to ios/theme.ts or new ios/lib/animations.ts
import { Easing } from 'react-native-reanimated';

export const timing = {
  fast: 150,       // Micro-interactions: tab switch feedback, button press
  normal: 250,     // Standard transitions: card appearance, list items
  slow: 350,       // Full screen transitions, modals
} as const;

export const easing = {
  default: Easing.bezier(0.25, 0.1, 0.25, 1.0),    // CSS ease equivalent
  easeOut: Easing.bezier(0.0, 0.0, 0.2, 1.0),      // Decelerate - for entering
  easeIn: Easing.bezier(0.4, 0.0, 1.0, 1.0),       // Accelerate - for exiting
  easeInOut: Easing.bezier(0.4, 0.0, 0.2, 1.0),     // Standard curve
} as const;
```

### Pattern 3: Reanimated Entering/Exiting for Component Mount
**What:** Use Reanimated's predefined `entering` and `exiting` props on `Animated.View` for component-level animations.
**When to use:** When a component mounts/unmounts (list items appearing, feedback cards, quiz transitions).
**Example:**
```typescript
import Animated, { FadeIn, FadeOut, SlideInRight } from 'react-native-reanimated';

// Quiz answer feedback - fade in when result shown
<Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)}>
  <AnswerFeedback isCorrect={isCorrect} ... />
</Animated.View>

// List items with stagger
{items.map((item, index) => (
  <Animated.View
    key={item.id}
    entering={FadeIn.delay(index * 50).duration(250)}
  >
    <ContentCard ... />
  </Animated.View>
))}
```

### Pattern 4: Native Stack Animation Configuration
**What:** Configure animation type and duration on expo-router's Stack navigator.
**When to use:** Control screen-to-screen transition speed and style.
**Example:**
```typescript
// ios/app/_layout.tsx
<Stack
  screenOptions={{
    headerShown: false,
    contentStyle: { backgroundColor: '#0A0F1A' },
    animation: 'slide_from_right',  // Already default on iOS
    animationDuration: 250,          // Faster than default 350ms
  }}
>
  {/* Modal screens get different animation */}
  <Stack.Screen
    name="oauth/[platform]"
    options={{
      presentation: 'modal',
      animation: 'slide_from_bottom',
      animationDuration: 300,
    }}
  />
</Stack>
```

### Pattern 5: Freemium Lock Overlay on Glass Surface
**What:** A semi-transparent overlay with blur + lock icon placed over GlassCard/GlassSurface.
**When to use:** Content that requires premium access. Visual indicator only (no payment wiring).
**Example:**
```typescript
// ios/components/glass/GlassLockOverlay.tsx
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Lock } from 'lucide-react-native';
import { colors } from '../../theme';

interface GlassLockOverlayProps {
  children: React.ReactNode;
  locked?: boolean;
}

export function GlassLockOverlay({ children, locked = false }: GlassLockOverlayProps) {
  return (
    <View style={styles.container}>
      {children}
      {locked && (
        <View style={styles.overlay}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.lockContainer}>
            <Lock size={24} color={colors.textSecondary} strokeWidth={1.75} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14, // Match GlassSurface lg radius
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(10, 15, 26, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

### Anti-Patterns to Avoid
- **Over-animating:** Do NOT animate every single view. Only animate state transitions that convey meaning (item appearing, screen change, feedback response). Gratuitous animation feels cheap, not premium.
- **Blocking animations:** Never make the user wait for an animation to complete before they can interact. All animations should be interruptible.
- **Inconsistent timing:** Using different durations for the same type of transition across the app. Centralize constants.
- **Animated.Value for new code:** The codebase has legacy `Animated.Value` in Skeleton and Toast. New animations should use Reanimated (`useSharedValue` + `useAnimatedStyle`). Do NOT introduce more legacy `Animated` usage.
- **Heavy spring physics on low-end devices:** Keep spring configs simple. `damping: 15-20`, `stiffness: 100-150`. Avoid extreme values.
- **Haptic spam:** Do NOT fire haptics on scroll, on every list item render, or continuously. Only on discrete user actions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Component enter/exit animation | Custom opacity/translate tracking with useEffect | Reanimated `entering`/`exiting` props (FadeIn, SlideInRight, etc.) | Layout animations handle mount/unmount lifecycle automatically, work on UI thread |
| Screen transition timing | JavaScript-based Stack navigator with custom interpolators | Native Stack `animationDuration` prop | Native stack runs at 60fps natively; JS stack is always slower |
| Haptic feedback abstraction | Platform-specific vibration patterns | `expo-haptics` (ImpactFeedbackStyle, NotificationFeedbackType) | Maps directly to iOS UIFeedbackGenerator; handles Android vibrator fallback |
| Skeleton pulse animation | Current manual `Animated.loop` in Skeleton.tsx | Reanimated `useAnimatedStyle` + `withRepeat(withTiming(...))` | Runs on UI thread, more performant, consistent with new animation system |
| Button press scale feedback | CSS-like transform on Pressable style | Reanimated `withSpring` scale on shared value | Smoother physics-based spring vs. instant opacity change |

**Key insight:** The project already has Reanimated 4.1.1 installed but uses it nowhere. All current animations use the legacy `Animated` API. Phase 16 should migrate animation patterns to Reanimated for consistency and performance, and all NEW animations must use Reanimated exclusively.

## Common Pitfalls

### Pitfall 1: nativeID Conflict on New Architecture
**What goes wrong:** Reanimated's entering/exiting animations use `nativeID` internally on Fabric (New Architecture). If you manually set `nativeID` on the same `Animated.View`, the entering animation silently fails.
**Why it happens:** Reanimated needs `nativeID` to configure the animation internally on Fabric.
**How to avoid:** Never set `nativeID` on `Animated.View` components that use `entering`/`exiting` props.
**Warning signs:** Animation works in development but fails silently on device. No error thrown.

### Pitfall 2: View Flattening Breaks Exiting Animations
**What goes wrong:** On New Architecture, React Native flattens views for performance. If a parent non-animated view is removed, child exiting animations never play because the parent unmounts immediately.
**Why it happens:** Fabric view flattening doesn't wait for child animations.
**How to avoid:** The component that gets unmounted should itself have the `exiting` prop. Don't rely on a parent wrapping an `Animated.View` with exit animation if the parent is what gets conditionally rendered.
**Warning signs:** `entering` animations work but `exiting` animations are instant/invisible.

### Pitfall 3: AnimationDuration Only Works for Specific Animation Types on iOS
**What goes wrong:** Setting `animationDuration: 250` on a `presentation: 'card'` screen has no effect. It only works with `slide_from_bottom`, `fade_from_bottom`, `fade`, and `simple_push` on iOS.
**Why it happens:** iOS default push animation (UINavigationController) has a fixed system duration that cannot be overridden via react-native-screens.
**How to avoid:** For card-style push screens, the iOS default animation is ~350ms and cannot be meaningfully shortened via `animationDuration`. Instead, set `animation: 'fade'` with `animationDuration: 250` if a faster transition is desired, or accept the iOS default.
**Warning signs:** Setting `animationDuration` has no visible effect. Transition speed doesn't change.

### Pitfall 4: Haptic Feedback in Low Power Mode
**What goes wrong:** On iOS, haptic feedback does nothing in Low Power Mode or when the Taptic Engine is disabled in system settings.
**Why it happens:** iOS system restriction, not a bug.
**How to avoid:** Never use haptics as the ONLY feedback mechanism. Always pair haptics with visual feedback (color change, animation, etc.).
**Warning signs:** User reports "nothing happens" on button press - test with Low Power Mode on.

### Pitfall 5: Stagger Animation with Large Lists
**What goes wrong:** Staggering FadeIn.delay(index * 50) with 100+ items creates a 5+ second total animation, and items at the bottom animate long after the user has scrolled past.
**Why it happens:** Linear stagger doesn't account for viewport visibility.
**How to avoid:** Cap stagger to first 8-10 visible items. Items beyond the fold should appear immediately or with a fixed short delay.
**Warning signs:** Scrolling a long list feels sluggish. Items appear blank for too long.

### Pitfall 6: Mixing Legacy Animated and Reanimated
**What goes wrong:** Using both `Animated.View` from `react-native` and `Animated.View` from `react-native-reanimated` in the same render tree causes import conflicts and confusion.
**Why it happens:** Both libraries export `Animated`.
**How to avoid:** Import Reanimated as `import Animated from 'react-native-reanimated'` and alias any legacy usage. In new code, always use Reanimated's `Animated`.
**Warning signs:** TypeScript errors about incompatible types. `Animated.View` doesn't accept `entering`/`exiting` props.

## Code Examples

Verified patterns from official documentation:

### Haptic Feedback on Button Press
```typescript
// Source: https://docs.expo.dev/versions/latest/sdk/haptics/
import * as Haptics from 'expo-haptics';

// In a Pressable/Button onPress handler:
const handlePress = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  // ... rest of handler
};

// For quiz answer submission:
const handleSubmitAnswer = (isCorrect: boolean) => {
  if (isCorrect) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } else {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
};

// For tab switch:
const handleTabPress = () => {
  Haptics.selectionAsync();
};
```

### Entering/Exiting Animations
```typescript
// Source: https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/entering-exiting-animations/
import Animated, { FadeIn, FadeOut, FadeInDown } from 'react-native-reanimated';

// Quiz feedback card - fade in when shown, fade out when dismissed
{showFeedback && (
  <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)}>
    <AnswerFeedback ... />
  </Animated.View>
)}

// List items with stagger (capped at 8)
{items.map((item, index) => (
  <Animated.View
    key={item.id}
    entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(250)}
  >
    <ItemCard ... />
  </Animated.View>
))}
```

### withTiming and withSpring for Interactive Animations
```typescript
// Source: https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/customizing-animation/
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing
} from 'react-native-reanimated';

// Button press scale animation
function AnimatedButton({ onPress, children }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={animatedStyle}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
```

### Native Stack Animation Configuration
```typescript
// Source: https://docs.expo.dev/router/advanced/stack/
// Source: https://reactnavigation.org/docs/native-stack-navigator/
<Stack
  screenOptions={{
    headerShown: false,
    contentStyle: { backgroundColor: '#0A0F1A' },
    // iOS uses native push animation by default (~350ms, not configurable for card)
    // For screens that want custom timing:
    // animation: 'fade' + animationDuration: 250 gives a fast cross-fade
  }}
>
  {/* Modal screens use slide_from_bottom with custom duration */}
  <Stack.Screen
    name="oauth/[platform]"
    options={{
      presentation: 'modal',
      animation: 'slide_from_bottom',
      animationDuration: 300,
    }}
  />

  {/* Quiz screen gets a fade transition */}
  <Stack.Screen
    name="quiz/[id]"
    options={{
      animation: 'fade',
      animationDuration: 250,
    }}
  />
</Stack>
```

### Contextual Loading State (Quiz Generation)
```typescript
// Animated loading state that replaces the current ActivityIndicator-only LoadingScreen
import Animated, { FadeIn, FadeInUp, withRepeat, withTiming, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Brain } from 'lucide-react-native';

function QuizLoadingState() {
  const pulse = useSharedValue(0.6);

  // Start pulse on mount
  React.useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 800 }),
      -1, // infinite
      true // reverse
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
      <Animated.View style={pulseStyle}>
        <Brain size={48} color={colors.accent} strokeWidth={1.5} />
      </Animated.View>
      <Text variant="body" color="secondary">Generation du quiz...</Text>
    </Animated.View>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Animated` from react-native | `react-native-reanimated` Animated | Reanimated 2+ (2021), mandatory in v4 (2025) | UI thread animations, 60fps guaranteed, entering/exiting layout animations |
| Custom spring physics | `withSpring` with mass/stiffness/damping | Reanimated 2+ | Physics-based springs feel more natural than duration-based timing |
| Manual vibration API | `expo-haptics` | Expo SDK 36+ | Semantic haptics (impact, notification, selection) vs raw vibration patterns |
| JavaScript-based stack navigator | Native stack (react-native-screens) | React Navigation 6+ | Native iOS/Android transitions, no JS bridge overhead |
| Opacity toggle for press feedback | Reanimated spring scale + opacity | Always available, increasingly standard | Fluid, physics-based response vs. binary opacity switch |

**Deprecated/outdated:**
- **Animated.timing from react-native core:** Still works but runs on JS thread. All new animations should use Reanimated.
- **Shared Element Transitions (Reanimated 4):** Available behind feature flag in Reanimated 4.2.0 but explicitly OUT OF SCOPE for this phase (per prior decisions).
- **Moti library:** Wrapper around Reanimated. Unnecessary since we use Reanimated directly.

## Open Questions

1. **animationDuration on iOS card push transitions**
   - What we know: `animationDuration` only applies to `fade`, `fade_from_bottom`, `slide_from_bottom`, and `simple_push` on iOS. The default card push animation (~350ms) on iOS cannot have its duration changed via this prop.
   - What's unclear: Whether setting `animation: 'simple_push'` with `animationDuration: 250` produces a result close enough to the default iOS push. The visual difference may be subtle or may look wrong.
   - Recommendation: Test `animation: 'simple_push'` + `animationDuration: 250` on device. If it looks bad, keep the iOS default for card transitions and only customize modal/quiz transitions. The requirement says 200-300ms; iOS default ~350ms is close enough and feels native.

2. **Tab switch animation**
   - What we know: Bottom tab navigation in React Navigation doesn't have a built-in cross-fade animation API. Tab content swaps instantly.
   - What's unclear: Whether adding a `FadeIn` animation to each tab screen's root component is sufficient to create a subtle "alive" feeling on tab switch.
   - Recommendation: Add `FadeIn.duration(150)` as `entering` animation on each tab screen's root `Animated.View`. This gives a subtle fade-in on tab switch without fighting the navigation system.

3. **Which screens get freemium lock overlays**
   - What we know: The requirement says "Freemium-locked content shows lock icon overlay on glass surface (visual only, no payment wiring)."
   - What's unclear: Which specific content/features should appear locked. This is a product decision.
   - Recommendation: Add `GlassLockOverlay` component with a `locked` boolean prop. Apply it to 2-3 example surfaces (e.g., the 3rd daily theme card on Home, some suggestion cards in Explorer). Keep it visual-only and easily toggleable. The planner can specify exact surfaces.

4. **Migrating existing Skeleton.tsx and Toast.tsx to Reanimated**
   - What we know: Both files use the legacy `Animated` API. They work fine but are inconsistent with new Reanimated-based animations.
   - What's unclear: Whether migration introduces any risk for these working components.
   - Recommendation: Migrate as part of Phase 16 to establish consistency. The migration is mechanical (replace `Animated.Value` with `useSharedValue`, `Animated.timing` with `withTiming`). Low risk, high consistency benefit.

## Codebase Inventory

### Current Animation Usage
| File | Animation Type | Library | Notes |
|------|---------------|---------|-------|
| `ios/components/ui/Skeleton.tsx` | Pulse opacity loop | RN `Animated` | Legacy pattern, works, candidate for migration |
| `ios/components/ui/Toast.tsx` | Spring translate + timing exit | RN `Animated` | Legacy pattern, works, candidate for migration |
| All other components | None | N/A | Static renders, opacity toggle on Pressable press |

### Current Press Feedback
| Component | Feedback | Pattern |
|-----------|----------|---------|
| `Button.tsx` | `pressed && { opacity: 0.8 }` | Static opacity |
| `GlassButton.tsx` | `pressed && styles.pressed` (opacity: 0.8) | Static opacity |
| `GlassCard.tsx` (with onPress) | `pressed && { opacity: 0.8 }` | Static opacity |
| `ContentCard.tsx` | `pressed && { opacity: 0.85, scale: 0.98 }` | Static opacity + scale |
| `ThemeCard.tsx` | `pressed && { opacity: 0.7 }` | Static opacity |
| All quiz options | `TouchableOpacity activeOpacity={0.7}` | Static opacity |

### Haptic Feedback Points (to add)
| Interaction | Haptic Type | Reason |
|-------------|-------------|--------|
| Button press (primary action) | `impactAsync(Light)` | Tactile confirmation of tap |
| Tab switch | `selectionAsync()` | Selection change feedback |
| Quiz answer selection | `selectionAsync()` | Option pick feedback |
| Quiz answer submission | `impactAsync(Medium)` | Submission confirmation |
| Quiz correct answer | `notificationAsync(Success)` | Positive reinforcement |
| Quiz wrong answer | `notificationAsync(Error)` | Negative feedback |
| Triage batch action | `notificationAsync(Success)` | Bulk action completion |
| Pull-to-refresh trigger | `impactAsync(Light)` | Refresh initiation |

### Screens Inventory (candidates for animation polish)
| Screen | File | Current Loading | Animation Opportunity |
|--------|------|----------------|----------------------|
| Home | `app/(tabs)/index.tsx` | `<LoadingScreen />` | Contextual loading, theme cards stagger-in |
| Explorer | `app/(tabs)/library.tsx` | `<LoadingScreen />` + `<Skeleton />` | Suggestion cards fade-in, content grid stagger |
| Revisions | `app/(tabs)/reviews.tsx` | `<LoadingScreen />` | Revision cards stagger-in |
| Profile | `app/(tabs)/profile.tsx` | N/A (no loading) | Glass cards stagger-in on mount |
| Quiz | `app/quiz/[id].tsx` | `<LoadingScreen />` | Question card fade transition, feedback slide-in |
| Content Detail | `app/content/[id].tsx` | Likely loading | Content info fade-in |

## Sources

### Primary (HIGH confidence)
- [expo-haptics official docs](https://docs.expo.dev/versions/latest/sdk/haptics/) - Full API reference: impactAsync, notificationAsync, selectionAsync, ImpactFeedbackStyle, NotificationFeedbackType enums
- [Reanimated entering/exiting animations](https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/entering-exiting-animations/) - Full list of predefined animations, modifier API (duration, delay, easing), Fabric compatibility notes
- [Reanimated customizing animation](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/customizing-animation/) - withTiming config (duration, easing), withSpring config (mass, stiffness, damping)
- [React Navigation native-stack-navigator](https://reactnavigation.org/docs/native-stack-navigator/) - animation, animationDuration, presentation options with types and defaults
- [Expo Router Stack docs](https://docs.expo.dev/router/advanced/stack/) - animation prop values, animationDuration (iOS only, defaults 350ms), presentation modes

### Secondary (MEDIUM confidence)
- [Reanimated compatibility table](https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility/) - Reanimated 4.x requires New Architecture (Fabric). Confirmed: project uses RN 0.81.5 with `newArchEnabled: true`.
- [Reanimated 4 overview (FreeCodeCamp)](https://www.freecodecamp.org/news/how-to-create-fluid-animations-with-react-native-reanimated-v4/) - Confirms Reanimated 4.x has CSS animations support, full backward compatibility with worklet API
- [react-native-screens issue #1453](https://github.com/software-mansion/react-native-screens/issues/1453) - animationDuration limitations with native stack in Expo managed workflow

### Tertiary (LOW confidence)
- N/A - All claims verified with official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed, verified versions in package.json
- Architecture: HIGH - Patterns verified against official Reanimated + expo-haptics docs, cross-checked with codebase structure
- Pitfalls: HIGH - Fabric nativeID issue documented officially, animationDuration limitation verified via multiple sources
- Code examples: HIGH - All examples verified against official API documentation

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (stable - no major library updates expected)
