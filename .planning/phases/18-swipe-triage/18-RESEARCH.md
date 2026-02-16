# Phase 18: Swipe Triage - Research

**Researched:** 2026-02-16
**Domain:** React Native gesture-driven card stack UX (swipe triage inbox)
**Confidence:** HIGH

## Summary

Phase 18 replaces the current tap-to-select grid inbox with a Tinder-style swipe card stack as the primary triage mode, while keeping bulk select as a secondary mode toggled via a button. The core technical challenge is building a performant card stack with pan gesture-driven spring animations that feel native, while integrating with the existing backend triage endpoints.

The project already has both critical libraries installed (`react-native-gesture-handler` ~2.28.0 and `react-native-reanimated` ~4.1.1), along with existing components (`SourcePills`, `SelectionBar`, `ContentCard`) that can be reused or adapted. The backend already supports all needed operations: `PATCH /api/content/:id/triage` for single-item triage (used by swipe mode), `POST /api/content/triage/bulk` for batch triage (used by bulk select mode), `GET /api/content/inbox` with platform filtering and `capturedAt desc` sorting, and `POST /api/content/refresh` for pull-to-refresh sync.

**Primary recommendation:** Build a custom `SwipeCardStack` component using `Gesture.Pan()` + `useSharedValue` + `useAnimatedStyle` + `withSpring` from the already-installed libraries. Do NOT add a third-party swipe card library -- the gesture/animation stack is already present and a custom component gives full control over the UX. The existing `library.tsx` tab will be refactored to default to swipe mode with a toggle button for bulk select mode.

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-native-gesture-handler` | ~2.28.0 | Pan gesture detection for swipe | Industry standard for RN gestures, works on UI thread |
| `react-native-reanimated` | ~4.1.1 | Spring animations, animated styles | 60fps animations via UI thread worklets |
| `expo-haptics` | ~15.0.8 | Tactile feedback on swipe threshold | Already used throughout app via `haptics` utility |
| `@tanstack/react-query` | ^5.90.20 | Data fetching, cache invalidation | Already powers all data hooks |
| `zustand` | ^5.0.11 | Triage mode state (swipe vs bulk) | Already used for content store |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react-native` | ^0.563.0 | Icons for keep/dismiss/toggle | Already used for all icons |
| `expo-blur` | ~15.0.8 | Glass card backgrounds | Used in GlassSurface component |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom card stack | `rn-swiper-list` or `react-native-swipeable-card-stack` | Third-party libs add dependency, less control over UX, potential version conflicts. Custom is better when gesture-handler + reanimated are already installed |
| `Gesture.Pan()` API | Legacy `PanGestureHandler` + `useAnimatedGestureHandler` | Old API, deprecated in gesture-handler v2. Modern `Gesture.Pan()` is cleaner |
| `withSpring` physics | `withTiming` + easing | Timing lacks the natural card feel. Spring physics are essential for satisfying swipe UX |

### Installation
No additional packages needed. Everything is already in `ios/package.json`.

## Architecture Patterns

### Recommended Component Structure
```
ios/
├── components/
│   └── content/
│       ├── SwipeCard.tsx          # NEW: Single swipeable card with Gesture.Pan
│       ├── SwipeCardStack.tsx     # NEW: Stack manager (renders 2-3 cards, manages state)
│       ├── SwipeOverlay.tsx       # NEW: Keep/Dismiss visual indicator overlay
│       ├── ContentCard.tsx        # EXISTING: Reuse for card visual content
│       ├── SourcePills.tsx        # EXISTING: Reuse as-is
│       ├── SelectionBar.tsx       # EXISTING: Reuse for bulk mode
│       └── TriageModeToggle.tsx   # NEW: Toggle button (swipe <-> bulk)
├── hooks/
│   ├── useInbox.ts               # EXISTING: Already has platform filter + pagination
│   └── useSwipeTriage.ts         # NEW: Single-item triage mutation (PATCH /:id/triage)
├── stores/
│   └── contentStore.ts           # EXISTING: Add triageMode state (swipe | bulk)
└── app/(tabs)/
    └── library.tsx               # MODIFY: Integrate swipe mode + bulk mode toggle
```

### Pattern 1: Gesture.Pan() Card Swipe
**What:** Use `Gesture.Pan()` from gesture-handler v2 with Reanimated shared values to track card position, apply rotation, and decide swipe outcome.
**When to use:** For the swipe card component.
**Example:**
```typescript
// Source: https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/handling-gestures/
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';

const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35; // 35% of screen width
const VELOCITY_THRESHOLD = 500; // px/s -- fast flick triggers swipe even if not past threshold

function SwipeCard({ onSwipeLeft, onSwipeRight, children }) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.3; // Dampen vertical movement
    })
    .onEnd((event) => {
      const shouldSwipeRight =
        translateX.value > SWIPE_THRESHOLD || event.velocityX > VELOCITY_THRESHOLD;
      const shouldSwipeLeft =
        translateX.value < -SWIPE_THRESHOLD || event.velocityX < -VELOCITY_THRESHOLD;

      if (shouldSwipeRight) {
        translateX.value = withSpring(SCREEN_WIDTH * 1.5, { stiffness: 900, damping: 120 });
        runOnJS(onSwipeRight)();
      } else if (shouldSwipeLeft) {
        translateX.value = withSpring(-SCREEN_WIDTH * 1.5, { stiffness: 900, damping: 120 });
        runOnJS(onSwipeLeft)();
      } else {
        // Snap back
        translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      {
        rotate: `${interpolate(
          translateX.value,
          [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
          [-10, 0, 10]
        )}deg`,
      },
    ],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={cardStyle}>{children}</Animated.View>
    </GestureDetector>
  );
}
```

### Pattern 2: Card Stack Rendering (2-3 visible cards)
**What:** Render only 2-3 cards from the inbox array. The top card is interactive; behind cards are scaled down for depth illusion.
**When to use:** For the `SwipeCardStack` component.
**Example:**
```typescript
// Render top 3 cards in reverse order (bottom first, top last for z-order)
const visibleCards = inboxItems.slice(currentIndex, currentIndex + 3);

{visibleCards.reverse().map((item, i) => {
  const actualIndex = visibleCards.length - 1 - i;
  const isTop = actualIndex === 0;
  return (
    <Animated.View
      key={item.id}
      style={[
        StyleSheet.absoluteFill,
        {
          transform: [
            { scale: 1 - actualIndex * 0.05 },    // Slightly smaller behind
            { translateY: actualIndex * -8 },        // Peek from behind
          ],
        },
      ]}
    >
      {isTop ? (
        <SwipeCard onSwipeLeft={handleDismiss} onSwipeRight={handleKeep}>
          <InboxCardContent item={item} />
        </SwipeCard>
      ) : (
        <InboxCardContent item={item} />
      )}
    </Animated.View>
  );
})}
```

### Pattern 3: Swipe Direction Overlay Indicator
**What:** Show a green checkmark / red X overlay that fades in based on swipe direction, giving immediate visual feedback.
**When to use:** Overlaid on the swiping card.
**Example:**
```typescript
const overlayStyle = useAnimatedStyle(() => ({
  opacity: interpolate(
    translateX.value,
    [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD / 2, 0, SWIPE_THRESHOLD / 2, SWIPE_THRESHOLD],
    [1, 0.5, 0, 0.5, 1]
  ),
}));

// Show green "KEEP" when swiping right, red "DISMISS" when swiping left
const keepOpacity = useAnimatedStyle(() => ({
  opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], 'clamp'),
}));
const dismissOpacity = useAnimatedStyle(() => ({
  opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], 'clamp'),
}));
```

### Pattern 4: runOnJS Bridge for Mutations
**What:** Gesture callbacks run on the UI thread (worklets). To trigger React state changes or API calls, wrap JS functions with `runOnJS`.
**When to use:** Always when calling non-worklet functions from gesture handlers.
**Example:**
```typescript
import { runOnJS } from 'react-native-reanimated';

// In gesture .onEnd():
if (shouldSwipeRight) {
  runOnJS(handleKeep)(item.id);  // Triggers PATCH /api/content/:id/triage
}
```

### Anti-Patterns to Avoid
- **Rendering all inbox items as cards:** Only render 2-3 visible cards. The rest stay in the data array. Rendering hundreds of animated views kills performance.
- **Using `useAnimatedGestureHandler`:** This is the legacy Reanimated 2.x API. Use `Gesture.Pan()` from gesture-handler v2 instead.
- **Calling JS functions directly in worklets:** Always use `runOnJS()` to bridge back to the JS thread for state updates and API calls.
- **Animating with `useState` for position:** Use `useSharedValue` exclusively for gesture-driven position tracking. React state causes re-renders; shared values animate on the UI thread.
- **Missing `GestureHandlerRootView`:** The app root (`_layout.tsx`) does NOT wrap with `GestureHandlerRootView`. It must be added for gestures to work. Currently only `theme/[id].tsx` wraps locally.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spring physics math | Custom spring equation | `withSpring()` from Reanimated | Handles mass, stiffness, damping, velocity properly |
| Gesture detection | `PanResponder` from RN | `Gesture.Pan()` from gesture-handler | PanResponder runs on JS thread = janky. Gesture.Pan runs on UI thread |
| Interpolation for rotation | Manual Math.atan2 | `interpolate()` from Reanimated | Handles clamping, extrapolation, multiple ranges |
| Card removal animation | Manual opacity + transform | `withSpring` to off-screen X + callback on finish | Spring with velocity continuation feels natural |
| Haptic feedback | Direct Haptics API calls | `haptics.medium()` from `lib/haptics.ts` | Already wraps expo-haptics with error handling |

**Key insight:** The entire animation+gesture stack is already installed and proven in this codebase (Toast uses `withSpring`, theme page uses `GestureHandlerRootView`). The swipe card is a composition of existing primitives, not a new paradigm.

## Common Pitfalls

### Pitfall 1: Missing GestureHandlerRootView
**What goes wrong:** Pan gestures are silently ignored -- no errors, just nothing happens when swiping.
**Why it happens:** `GestureHandlerRootView` must wrap the component tree for gestures to be recognized. The current app root (`_layout.tsx`) does not include it.
**How to avoid:** Add `GestureHandlerRootView` to the root layout (`app/_layout.tsx`), wrapping the entire `<Stack>`. This is a one-line change.
**Warning signs:** Gestures not firing in development; existing `SwipeableContentCard` only works in theme page because that page has its own wrapper.

### Pitfall 2: Optimistic UI Without Queue Cleanup
**What goes wrong:** User swipes a card, the card animates away, but the mutation fails (network error). The item disappears from the UI but stays in INBOX status on the server.
**Why it happens:** Swipe removes the card visually before the API call completes.
**How to avoid:** Use optimistic update via React Query's `onMutate` to remove from cache immediately, but implement `onError` rollback to re-insert the item. Also invalidate inbox query on `onSettled`.
**Warning signs:** Items reappearing after refresh, inbox count mismatch.

### Pitfall 3: Card Flicker on Fast Swiping
**What goes wrong:** Swiping quickly through 3-4 cards causes visible flicker or wrong card receiving gesture.
**Why it happens:** The `currentIndex` state update triggers re-render, which can momentarily show the wrong card as the top card.
**How to avoid:** Use a small delay (via `withSpring` callback) before advancing the index. Only advance after the fly-off animation completes. Keep the index in a ref for immediate reads and sync to state for renders.
**Warning signs:** Visual glitches when swiping rapidly.

### Pitfall 4: Pull-to-Refresh Conflict with Pan Gesture
**What goes wrong:** Pulling down to refresh also triggers the pan gesture, or the ScrollView swallows the pan gesture.
**Why it happens:** Both `RefreshControl` and `Gesture.Pan` respond to vertical gestures.
**How to avoid:** In swipe card stack mode, put RefreshControl on a wrapper ScrollView that is NOT the card stack. The card stack should NOT be inside a ScrollView. Alternatively, use `simultaneousHandlers` or add a dedicated refresh button instead of pull-to-refresh in swipe mode. The simplest approach: put the card stack inside a non-scrollable View, and place a transparent ScrollView behind or above with just a RefreshControl.
**Warning signs:** Pull-to-refresh not working, or card moving when trying to refresh.

### Pitfall 5: Pagination Edge -- Running Out of Cards
**What goes wrong:** User swipes through all loaded cards and sees empty state, even though more exist on the server.
**Why it happens:** `useInbox` uses infinite query with pages of 20. If user swipes 20 items, next page isn't loaded.
**How to avoid:** Pre-fetch next page when `currentIndex` approaches the end of the current page (e.g., 5 cards from end). Use `fetchNextPage` from useInfiniteQuery.
**Warning signs:** Briefly showing "empty inbox" then loading more items.

### Pitfall 6: Stale Data After Filter Change
**What goes wrong:** Switching platform filter while cards are in mid-animation causes crash or shows wrong content.
**Why it happens:** Filter change triggers new query, data array changes, but currentIndex is stale.
**How to avoid:** Reset `currentIndex` to 0 whenever filter changes. Cancel any in-flight animations.
**Warning signs:** Index out of bounds errors, showing archived items.

## Code Examples

Verified patterns from official sources and existing codebase:

### Single-Item Triage Hook (NEW)
```typescript
// hooks/useSwipeTriage.ts
// Wraps PATCH /api/content/:id/triage for swipe mode (one item at a time)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useSwipeTriage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contentId, action }: { contentId: string; action: 'learn' | 'archive' }) => {
      const { data } = await api.patch(`/content/${contentId}/triage`, { action });
      return data;
    },
    onMutate: async ({ contentId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['inbox'] });
      // Snapshot previous value for rollback
      const previous = queryClient.getQueryData(['inbox']);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(['inbox'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
}
```

### Zustand Triage Mode State
```typescript
// Add to stores/contentStore.ts
type TriageMode = 'swipe' | 'bulk';

// Add to state interface:
triageMode: TriageMode;
setTriageMode: (mode: TriageMode) => void;

// Add to create():
triageMode: 'swipe',
setTriageMode: (mode) => set({ triageMode: mode }),
```

### GestureHandlerRootView in Root Layout
```typescript
// Source: https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation/
// app/_layout.tsx - wrap the entire Stack
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// In the return:
<GestureHandlerRootView style={{ flex: 1 }}>
  <QueryClientProvider client={queryClient}>
    <StatusBar style="light" />
    <Stack>...</Stack>
  </QueryClientProvider>
</GestureHandlerRootView>
```

### withSpring Config for Card Fly-Off vs Snap-Back
```typescript
// Source: https://docs.swmansion.com/react-native-reanimated/docs/animations/withSpring/

// Fly off screen (fast, no bounce)
const FLY_OFF_SPRING = { stiffness: 900, damping: 120, mass: 4 };

// Snap back to center (bouncy, satisfying)
const SNAP_BACK_SPRING = { damping: 15, stiffness: 150, mass: 1 };

// Usage:
translateX.value = withSpring(SCREEN_WIDTH * 1.5, FLY_OFF_SPRING, (finished) => {
  if (finished) {
    runOnJS(advanceCard)();
  }
});
```

## Existing Codebase Assets (Reusable)

| Asset | Location | Reuse Strategy |
|-------|----------|----------------|
| `ContentCard` | `components/content/ContentCard.tsx` | Adapt for swipe card content (thumbnail, title, channel, platform badge) |
| `SourcePills` | `components/content/SourcePills.tsx` | Reuse as-is for platform filtering in both modes |
| `SelectionBar` | `components/content/SelectionBar.tsx` | Reuse as-is for bulk select mode |
| `useInbox` hook | `hooks/useInbox.ts` | Reuse as-is (already has platform filter + infinite query) |
| `useTriageMutation` | `hooks/useContent.ts` | Reuse for bulk mode. New hook for swipe mode (single item) |
| `useContentStore` | `stores/contentStore.ts` | Extend with `triageMode` state |
| `haptics` | `lib/haptics.ts` | Use `medium` for swipe threshold, `success`/`warning` for keep/dismiss |
| `colors`, `spacing`, `glass` | `theme.ts` | Design tokens for card styling |
| `Toast` | `components/ui/Toast.tsx` | Shows success/error feedback (already uses Reanimated springs) |
| `library.tsx` | `app/(tabs)/library.tsx` | Refactor: add swipe mode alongside existing bulk mode |

## Backend Endpoints (All Existing)

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `/api/content/inbox` | GET | Inbox items with platform filter, capturedAt desc | Both modes |
| `/api/content/inbox/count` | GET | Badge count | Tab badge |
| `/api/content/:id/triage` | PATCH | Single item triage (learn/archive) | Swipe mode |
| `/api/content/triage/bulk` | POST | Batch triage (learn/archive) | Bulk mode |
| `/api/content/refresh` | POST | Trigger platform sync (5-min cooldown) | Pull-to-refresh |
| `/api/admin/sync/all` | POST | Force sync all platforms | Pull-to-refresh (alternative) |

**No backend changes required for Phase 18.** All endpoints already exist and support the needed operations.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `PanGestureHandler` component | `Gesture.Pan()` API | gesture-handler v2 (2022) | Cleaner API, composable gestures |
| `useAnimatedGestureHandler` | Direct worklet callbacks on `Gesture.Pan()` | Reanimated 3+ (2023) | No need for separate hook |
| `Animated.event` from RN core | `useSharedValue` + `useAnimatedStyle` | Reanimated 2+ (2021) | UI thread animations, no bridge |
| Third-party swipe card libs | Custom with gesture-handler + reanimated | Ongoing | Better control, fewer deps, same perf |

**Deprecated/outdated:**
- `useAnimatedGestureHandler`: Deprecated in gesture-handler v2. Use `Gesture.Pan().onUpdate().onEnd()` directly.
- `PanGestureHandler` component: Replaced by `GestureDetector` + `Gesture.Pan()`.
- `Animated` from `react-native`: Do not use for gesture-driven animations. Use `react-native-reanimated` exclusively.

## Open Questions

1. **Card visual design for swipe mode**
   - What we know: Current `ContentCard` uses 16:9 thumbnail with title/channel below. Works well in 2-column grid.
   - What's unclear: Should swipe card be full-width? Should it show more info (description, synopsis)?
   - Recommendation: Use full-width card with larger thumbnail. Planner decides exact layout. Reuse `ContentCard` internals.

2. **Swipe mode as default tab behavior**
   - What we know: Current library tab has two sub-tabs: "Mes themes" and "Bibliotheque" (inbox grid).
   - What's unclear: Should swipe mode replace the inbox sub-tab? Or should there be a separate triage screen?
   - Recommendation: Replace the "Bibliotheque" sub-tab content with swipe mode as default, with toggle button in top-right to switch to bulk grid. Preserves existing navigation structure.

3. **Empty state after swiping all cards**
   - What we know: Backend returns paginated results. User might swipe through all loaded items.
   - What's unclear: What happens when all cards are swiped? Show empty state? Auto-load next page?
   - Recommendation: Pre-fetch next page when 5 cards remain. Show celebratory empty state ("All caught up!") when truly empty.

## Sources

### Primary (HIGH confidence)
- **Existing codebase** (`ios/package.json`, `ios/hooks/useInbox.ts`, `ios/components/content/*`, `backend/src/routes/content.ts`) - Verified all existing APIs, hooks, and components
- **Reanimated docs** (https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/handling-gestures/) - Gesture.Pan() + withSpring API
- **Reanimated withSpring API** (https://docs.swmansion.com/react-native-reanimated/docs/animations/withSpring/) - Spring config options (stiffness, damping, mass defaults)
- **Gesture Handler installation** (https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation/) - GestureHandlerRootView requirement
- **Expo gestures tutorial** (https://docs.expo.dev/tutorial/gestures/) - Gesture.Pan() + Reanimated in Expo SDK

### Secondary (MEDIUM confidence)
- **Reanimated layout animations** (https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/entering-exiting-animations/) - SlideOutLeft/Right for card exit
- **Multiple GitHub repos** (pakenfit/tinder-swipe, Skipperlla/rn-swiper-list, Joehoel/rn-tinder-card) - Confirmed patterns: 35-50% screen width threshold, velocity-based fast flick, 2-3 visible cards

### Tertiary (LOW confidence)
- None. All findings verified against official docs or existing codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and used in codebase
- Architecture: HIGH - Patterns verified against official Reanimated/gesture-handler docs
- Pitfalls: HIGH - GestureHandlerRootView gap confirmed by codebase inspection; optimistic update pattern from React Query docs
- Backend: HIGH - All endpoints verified by reading route files directly

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- no library upgrades expected)
