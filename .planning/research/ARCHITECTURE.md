# Architecture Patterns: Glass UI Design System Integration

**Domain:** Night Blue Glass UI design system for existing Expo iOS learning app
**Researched:** 2026-02-11
**Overall confidence:** HIGH -- based on direct codebase analysis, verified Expo/RN library APIs, and established design system patterns

---

## Executive Summary

The v3.0 milestone introduces a complete visual transformation: Night Blue dark palette, Glass UI surfaces via `expo-blur`, Geist typography via `@expo-google-fonts/geist`, Lucide icons replacing emoji, and a screen restructure from 4 tabs (Feed/Library/Memos/Profile) to 4 redesigned tabs (Home/Explorer/Revisions/Profile). This is a **visual reskin + screen restructure**, not an architectural rewrite -- the data layer (Zustand stores, React Query hooks, Axios API client, backend routes) remains largely unchanged.

The key architectural insight is that the design system must be built as a **replacement layer**, not an addition. The current `theme.ts` exports (`colors`, `spacing`, `fonts`, `borderRadius`, `shadows`, `layout`) are imported by every UI component and every screen. The Glass UI system replaces these values in-place (same export names, new values) plus adds new exports (`glass`, `gradients`, `typography`). This means existing components automatically pick up the new palette without individual migration, and new Glass components build on the same token system.

Two new backend endpoints (`GET /api/themes/daily` and `GET /api/themes/suggestions`) are lightweight additions to the existing themes router, requiring no schema changes.

---

## Current Architecture (as-is)

```
ios/
  theme.ts                    <-- Single flat file: colors, spacing, fonts, borderRadius, shadows, layout
  components/ui/              <-- 8 primitives: Text, Button, Card, Input, Badge, TopicChip, Skeleton, Toast
  components/                 <-- Feature: ThemeCard, LoadingScreen, EmptyState, ErrorState, content/*
  app/(tabs)/                 <-- 4 tabs: index (Feed), library, reviews, profile
  app/                        <-- Stack screens: theme/[id], quiz/[id], memo/[id], content/[id], etc.
  hooks/                      <-- React Query: useThemes, useContent, useQuiz, useReviews, etc.
  stores/                     <-- Zustand: authStore, contentStore
  lib/                        <-- api.ts (Axios), constants.ts, queryClient.ts, storage.ts
  types/                      <-- content.ts (Content, ThemeListItem, Quiz, etc.)
```

### Current Token Architecture

The `theme.ts` file is a flat export of 6 const objects:

```typescript
export const colors = { background: '#FFFFFF', surface: '#FAFAFA', text: '#0A0A0A', ... };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 20, xl: 28, xxl: 40 };
export const fonts = { regular: 'System', medium: 'System', bold: 'System' };
export const borderRadius = { xs: 4, sm: 6, md: 10, lg: 14, xl: 20, full: 9999 };
export const shadows = { sm: {...}, md: {...}, lg: {...} };
export const layout = { screenPadding: spacing.lg, buttonHeight: 48, inputHeight: 48, minTouchTarget: 44 };
```

Every component imports directly: `import { colors, spacing, borderRadius } from '../../theme'`. There is no ThemeProvider, no React Context, no dynamic theming. All values are compile-time constants. The app is hardcoded light mode.

### Current Component Patterns

Components follow a consistent pattern:
1. Props interface with TypeScript unions for variants
2. `StyleSheet.create()` at module level
3. Direct imports from `../../theme` (relative path)
4. No `useTheme()` hooks or context-based theming
5. Emojis for icons (tab bar, platform indicators, content cards)

### Import Dependency Map (theme.ts consumers)

| File | Imports |
|------|---------|
| `components/ui/Text.tsx` | `colors`, `fonts` |
| `components/ui/Button.tsx` | `colors`, `spacing`, `borderRadius`, `layout` |
| `components/ui/Card.tsx` | `colors`, `spacing`, `borderRadius` |
| `components/ui/Input.tsx` | `colors`, `spacing`, `borderRadius`, `layout` |
| `components/ui/Badge.tsx` | `colors`, `spacing` |
| `components/ui/Skeleton.tsx` | `colors`, `borderRadius` |
| `components/ui/Toast.tsx` | `colors`, `spacing`, `borderRadius` |
| `components/ThemeCard.tsx` | `colors`, `spacing`, `borderRadius`, `shadows` |
| `app/(tabs)/index.tsx` | `colors`, `spacing`, `borderRadius` |
| `app/(tabs)/library.tsx` | `colors`, `spacing`, `borderRadius`, `shadows` |
| `app/(tabs)/reviews.tsx` | `colors`, `spacing` |
| `app/(tabs)/profile.tsx` | `colors`, `spacing`, `borderRadius` |
| `app/(tabs)/_layout.tsx` | `colors` |

---

## Target Architecture (to-be)

```
ios/
  theme/                         <-- NEW: design system directory (replaces flat theme.ts)
    tokens.ts                    <-- colors, spacing, typography, borderRadius, shadows, glass, gradients
    index.ts                     <-- Re-exports everything (backward-compatible import path)
  components/ui/                 <-- MODIFIED: existing primitives updated to Night Blue palette
    Text.tsx                     <-- Updated: Geist font, Night Blue colors
    Button.tsx                   <-- Updated: Night Blue palette + glass variant
    Card.tsx                     <-- Updated: Night Blue surface color
    Input.tsx                    <-- Updated: Night Blue palette + glass variant
    Badge.tsx                    <-- Updated: Night Blue palette
    Skeleton.tsx                 <-- Updated: Night Blue pulse color
    Toast.tsx                    <-- Updated: Night Blue palette
    index.ts                     <-- MODIFIED: adds Glass* component exports
  components/ui/glass/           <-- NEW: Glass UI primitives
    GlassCard.tsx                <-- BlurView-based card with glass surface
    GlassButton.tsx              <-- BlurView-based button
    GlassSurface.tsx             <-- Reusable glass background container
    GlassInput.tsx               <-- Glass-styled input
    GlassTabBar.tsx              <-- Custom glass tab bar
    index.ts                     <-- Glass component barrel export
  components/icons/              <-- NEW: Lucide icon wrapper
    Icon.tsx                     <-- Unified Lucide icon component
    TabIcon.tsx                  <-- Tab bar icon component (replaces emoji TabIcon)
    PlatformIcon.tsx             <-- Platform-specific icon (replaces emoji mapping)
    index.ts                     <-- Icon barrel export
  app/(tabs)/                    <-- MODIFIED: 4 tabs restructured
    _layout.tsx                  <-- MODIFIED: Home/Explorer/Revisions/Profile + GlassTabBar
    index.tsx                    <-- REWRITTEN: Home screen (3 daily themes + stats)
    explorer.tsx                 <-- NEW: Explorer (Suggestions + Library tabs)
    revisions.tsx                <-- REWRITTEN: Revision cards with filter/search
    profile.tsx                  <-- MODIFIED: Night Blue styling
  app/_layout.tsx                <-- MODIFIED: StatusBar light, font loading, SafeAreaProvider
  hooks/useDaily.ts              <-- NEW: useDailyThemes hook
  hooks/useSuggestions.ts        <-- NEW: useThemeSuggestions hook
```

---

## Component Boundaries

### New Components

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **theme/tokens.ts** | All design tokens (colors, typography, spacing, glass, gradients) | Every component and screen |
| **GlassCard** | Blurred card surface with configurable intensity/tint | tokens.ts glass values |
| **GlassButton** | Glass-surface button with press states | tokens.ts glass values |
| **GlassSurface** | Generic glass background container | tokens.ts glass values |
| **GlassInput** | Text input with glass background | tokens.ts glass values |
| **GlassTabBar** | Custom bottom tab bar with glass effect | expo-router Tabs, tokens.ts |
| **Icon** | Lucide icon wrapper with theme-aware colors | lucide-react-native, tokens.ts |
| **TabIcon** | Tab bar icon using Lucide | Icon component |
| **PlatformIcon** | YouTube/Spotify/TikTok/Instagram icons | Icon component or custom SVGs |
| **useDaily hook** | Fetches 3 daily themes | `GET /api/themes/daily` |
| **useSuggestions hook** | Fetches 8 AI suggestions | `GET /api/themes/suggestions` |

### Modified Components (file-level changes)

| Component | What Changes | Why |
|-----------|-------------|-----|
| **theme.ts** -> **theme/tokens.ts** | Color values, font values, add glass/gradient tokens | Night Blue palette, Geist font |
| **Text.tsx** | fontFamily references to Geist weights | Typography overhaul |
| **Button.tsx** | Color references + add 'glass' variant | Night Blue + glass option |
| **Card.tsx** | backgroundColor from `colors.surface` (now dark surface) | Palette swap |
| **Input.tsx** | Border/bg colors, placeholder color | Night Blue palette |
| **Badge.tsx** | Background colors | Night Blue palette |
| **Skeleton.tsx** | Pulse color from light gray to dark blue-gray | Dark palette |
| **ThemeCard.tsx** | Complete restyle with glass surface | Glass UI treatment |
| **app/_layout.tsx** | Add font loading, StatusBar style='light' | Geist fonts + dark status bar text |
| **app/(tabs)/_layout.tsx** | New tab names/icons, custom tab bar | Screen restructure |
| **app/(tabs)/index.tsx** | Full rewrite for Home screen | Daily themes + stats layout |
| **app/(tabs)/reviews.tsx** | Restyle + add filter/search | Night Blue + new functionality |
| **app/(tabs)/profile.tsx** | Restyle for Night Blue | Palette swap |

### Unchanged Components

| Component | Why Unchanged |
|-----------|--------------|
| `stores/authStore.ts` | No visual concerns, pure auth logic |
| `stores/contentStore.ts` | Filter state logic only, no visuals |
| `hooks/useThemes.ts` | Data layer, no visual dependencies |
| `hooks/useContent.ts` | Data layer |
| `hooks/useQuiz.ts` | Data layer |
| `hooks/useReviews.ts` | Data layer |
| `lib/api.ts` | HTTP client, no visuals |
| `lib/queryClient.ts` | Cache config, no visuals |
| `lib/storage.ts` | SecureStore wrapper, no visuals |
| `types/content.ts` | TypeScript interfaces (add DailyTheme type only) |
| All backend routes | No changes needed for visual redesign |
| Quiz components (QuestionCard, AnswerFeedback, QuizSummary) | Restyle in-place via tokens, no structural change |

---

## Design Token Architecture

### Recommended: Flat Module with Named Exports (evolution of current pattern)

**Confidence: HIGH** -- This preserves backward compatibility with all existing imports.

The current `theme.ts` is a flat file. Evolve it to a directory `theme/` with the same export surface:

```typescript
// ios/theme/tokens.ts

// ============================================================================
// Night Blue Palette
// ============================================================================

export const colors = {
  // Core palette - Night Blue
  background: '#0A0F1A',          // Deep navy, primary background
  surface: '#111827',              // Slightly elevated surface
  surfaceElevated: '#1E293B',      // Cards, modals
  surfaceGlass: 'rgba(17, 24, 39, 0.7)',  // Glass surfaces (used with BlurView)

  // Text hierarchy on dark
  text: '#F8FAFC',                 // Primary text (near-white)
  textSecondary: '#94A3B8',        // Secondary text (slate)
  textTertiary: '#64748B',         // Muted text
  textMuted: '#475569',            // Disabled/placeholder

  // Accent - Soft Gold
  accent: '#D4A574',               // Primary accent
  accentLight: 'rgba(212, 165, 116, 0.15)', // Accent background tint
  accentMuted: '#B8956A',          // Pressed/disabled accent

  // Borders on dark
  border: '#1E293B',               // Subtle border
  borderLight: '#334155',          // More visible border
  borderGlass: 'rgba(255, 255, 255, 0.08)', // Glass surface border

  // Semantic (unchanged conceptually, adjusted for dark)
  error: '#EF4444',
  errorBg: 'rgba(239, 68, 68, 0.15)',
  success: '#22C55E',
  successBg: 'rgba(34, 197, 94, 0.15)',
  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.15)',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.4)',
  overlayStrong: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(255, 255, 255, 0.05)',
} as const;

// ============================================================================
// Glass Surface Tokens
// ============================================================================

export const glass = {
  // BlurView intensity levels (1-100)
  intensity: {
    light: 20,       // Subtle background blur
    medium: 40,      // Standard glass surface
    heavy: 60,       // Navigation bars, modals
  },
  // BlurView tint
  tint: 'dark' as const,
  // Glass surface background (applied INSIDE BlurView)
  background: {
    subtle: 'rgba(17, 24, 39, 0.3)',
    standard: 'rgba(17, 24, 39, 0.5)',
    solid: 'rgba(17, 24, 39, 0.7)',
  },
  // Glass border
  border: {
    width: 1,
    color: 'rgba(255, 255, 255, 0.08)',
  },
} as const;

// ============================================================================
// Typography - Geist Font Family
// ============================================================================

export const fonts = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
} as const;

export const typography = {
  h1: { fontSize: 28, fontFamily: fonts.bold, lineHeight: 36, letterSpacing: -0.5 },
  h2: { fontSize: 24, fontFamily: fonts.bold, lineHeight: 32, letterSpacing: -0.3 },
  h3: { fontSize: 20, fontFamily: fonts.semibold, lineHeight: 28, letterSpacing: -0.2 },
  body: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 24 },
  bodyMedium: { fontSize: 16, fontFamily: fonts.medium, lineHeight: 24 },
  caption: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 20 },
  label: { fontSize: 12, fontFamily: fonts.medium, lineHeight: 16, letterSpacing: 0.5 },
  tabLabel: { fontSize: 10, fontFamily: fonts.medium, lineHeight: 14 },
} as const;

// ============================================================================
// Spacing (unchanged values, same scale)
// ============================================================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  xxl: 40,
} as const;

// ============================================================================
// Border Radius (unchanged values)
// ============================================================================

export const borderRadius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

// ============================================================================
// Shadows (adjusted for dark background)
// ============================================================================

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: '#D4A574',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 0,
  },
} as const;

// ============================================================================
// Layout (same values, extended)
// ============================================================================

export const layout = {
  screenPadding: spacing.lg,
  buttonHeight: 48,
  inputHeight: 48,
  minTouchTarget: 44,
  tabBarHeight: 80,
  statusBarStyle: 'light' as const,
} as const;

// ============================================================================
// Gradients (for LinearGradient usage)
// ============================================================================

export const gradients = {
  // Background gradient overlays
  screenFade: ['rgba(10, 15, 26, 0)', 'rgba(10, 15, 26, 1)'],     // Fade to bg
  cardShine: ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0)'], // Subtle shine
  accent: ['#D4A574', '#B8956A'],                                    // Gold gradient
  // Progress bar
  progress: ['#D4A574', '#E8C49A'],
} as const;

// ============================================================================
// Animation (micro-interaction timing)
// ============================================================================

export const animation = {
  fast: 150,
  normal: 250,
  slow: 400,
  spring: { damping: 15, stiffness: 150 },
} as const;
```

### Backward-Compatible Re-export

```typescript
// ios/theme/index.ts
// This file ensures ALL existing imports work unchanged:
// import { colors, spacing } from '../../theme' --> now resolves to theme/index.ts

export {
  colors,
  spacing,
  fonts,
  borderRadius,
  shadows,
  layout,
  glass,
  typography,
  gradients,
  animation,
} from './tokens';
```

This means every existing `import { colors, spacing } from '../../theme'` continues to work without any import path changes. The directory `theme/` replaces the file `theme.ts` because Node/Metro resolves `theme` to `theme/index.ts` automatically.

---

## Glass Component Architecture

### Core Pattern: GlassSurface as Foundation

All Glass components are built on a single foundational component: `GlassSurface`. This avoids duplicating BlurView configuration across components.

```typescript
// ios/components/ui/glass/GlassSurface.tsx

import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { glass, borderRadius, colors } from '../../../theme';

type GlassIntensity = 'light' | 'medium' | 'heavy';

interface GlassSurfaceProps {
  children: React.ReactNode;
  intensity?: GlassIntensity;
  style?: StyleProp<ViewStyle>;
  borderRadiusSize?: keyof typeof borderRadius;
}

export function GlassSurface({
  children,
  intensity = 'medium',
  style,
  borderRadiusSize = 'md',
}: GlassSurfaceProps) {
  return (
    <View style={[
      styles.container,
      { borderRadius: borderRadius[borderRadiusSize] },
      style,
    ]}>
      <BlurView
        intensity={glass.intensity[intensity]}
        tint={glass.tint}
        style={StyleSheet.absoluteFill}
      />
      <View style={[
        styles.innerBorder,
        { borderRadius: borderRadius[borderRadiusSize] },
      ]} />
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  innerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: glass.border.width,
    borderColor: glass.border.color,
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});
```

### GlassCard = GlassSurface + Card Props

```typescript
// ios/components/ui/glass/GlassCard.tsx

import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { spacing } from '../../../theme';

type GlassPadding = 'none' | 'sm' | 'md' | 'lg';

interface GlassCardProps {
  children: React.ReactNode;
  padding?: GlassPadding;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  intensity?: 'light' | 'medium' | 'heavy';
}

const paddingMap: Record<GlassPadding, number> = {
  none: 0, sm: spacing.sm, md: spacing.md, lg: spacing.lg,
};

export function GlassCard({ children, padding = 'md', onPress, style, intensity }: GlassCardProps) {
  const content = (
    <GlassSurface intensity={intensity} style={[{ padding: paddingMap[padding] }, style]}>
      {children}
    </GlassSurface>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
        {content}
      </Pressable>
    );
  }

  return content;
}
```

### Component Hierarchy

```
GlassSurface (foundation -- manages BlurView, border, overflow)
  |
  +-- GlassCard (adds padding + pressable behavior)
  +-- GlassButton (adds press states, loading, variants)
  +-- GlassInput (adds TextInput with glass background)
  +-- GlassTabBar (custom tab bar implementation)
```

---

## Screen Restructure Architecture

### Tab Mapping: Old -> New

| Old Tab | New Tab | Route File | Changes |
|---------|---------|------------|---------|
| Feed (`index.tsx`) | Home | `app/(tabs)/index.tsx` | **REWRITE**: Daily themes (3 cards), stats summary, quick actions |
| Library (`library.tsx`) | Explorer | `app/(tabs)/explorer.tsx` | **NEW FILE**: Suggestions tab (8 AI) + Library tab (existing filters) |
| Memos (`reviews.tsx`) | Revisions | `app/(tabs)/revisions.tsx` | **REWRITE**: Revision cards + category filter + search |
| Profile (`profile.tsx`) | Profile | `app/(tabs)/profile.tsx` | **MODIFY**: Night Blue restyle, remove dev tools in prod |

### Tab Bar: Custom Glass Implementation

The current tab bar uses default Expo Router `Tabs` with emoji icons. Replace with a custom `tabBar` prop that renders a `GlassTabBar`:

```typescript
// app/(tabs)/_layout.tsx

import { Tabs } from 'expo-router';
import { GlassTabBar } from '../../components/ui/glass';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,  // We handle our own headers
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="explorer" options={{ title: 'Explorer' }} />
      <Tabs.Screen name="revisions" options={{ title: 'Revisions' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
```

**Confidence: HIGH** -- The Expo Router `Tabs` component supports a `tabBar` prop for custom tab bar rendering. This is the documented approach.

### Home Screen Data Flow

```
Home Screen (app/(tabs)/index.tsx)
  |
  +-- useDailyThemes() --> GET /api/themes/daily --> 3 theme objects
  |     Query key: ['themes', 'daily']
  |     Stale time: 1 hour (daily subjects change infrequently)
  |
  +-- useReviewStats() --> GET /api/reviews/stats --> { streak, todayCount, totalCount }
  |     (already exists)
  |
  +-- useThemes() --> GET /api/themes --> all user themes
       (already exists, used for "Your themes" section)
```

### Explorer Screen Data Flow

```
Explorer Screen (app/(tabs)/explorer.tsx)
  |
  +-- Tab 1: Suggestions
  |     useSuggestions() --> GET /api/themes/suggestions --> 8 AI suggestions
  |     Query key: ['themes', 'suggestions']
  |     Stale time: 30 minutes
  |
  +-- Tab 2: Library
        useContentList(filters) --> GET /api/content --> paginated content
        (already exists, moved from library.tsx)
        useInbox() / useInboxCount() --> triage flow
        (already exists, moved from library.tsx)
```

### Revisions Screen Data Flow

```
Revisions Screen (app/(tabs)/revisions.tsx)
  |
  +-- useReviews({ filter, search }) --> GET /api/reviews/due?filter=X&q=Y
  |     (extends existing hook with filter/search params)
  |
  +-- Category filter chips (local state)
  +-- Search input (local state, debounced)
```

---

## Backend Integration

### New Endpoints (added to existing `backend/src/routes/themes.ts`)

#### `GET /api/themes/daily`

Returns 3 themes for the user to review today. Smart rotation based on:
1. Due cards count (themes with most due cards first)
2. Last reviewed (themes not reviewed recently)
3. Content count minimum (themes with >= 3 content items)

```typescript
// Response shape
{
  themes: [
    {
      id: string,
      name: string,
      emoji: string,
      color: string,
      contentCount: number,
      dueCards: number,
      masteryPercent: number,
      reason: 'due_cards' | 'not_reviewed' | 'new_content'
    },
    // ... (3 items)
  ],
  generatedAt: string  // ISO timestamp
}
```

**Implementation approach:** No new table needed. Query existing Theme + Card data, sort by due cards DESC and last quiz session date ASC, take top 3. Cache in memory (per-user, 1 hour TTL) or compute on each request since the query is lightweight.

#### `GET /api/themes/suggestions`

Returns up to 8 AI-generated theme suggestions based on user's uncategorized content.

```typescript
// Response shape
{
  suggestions: [
    {
      name: string,
      emoji: string,
      color: string,
      reason: string,          // "Vous avez 5 videos sur ce sujet"
      matchingContentCount: number,
      sampleContentTitles: string[]  // 2-3 example titles
    },
    // ... (up to 8 items)
  ]
}
```

**Implementation approach:** Reuse existing theme suggestion logic from `services/themeClassification.ts`. Analyze unclassified content tags, cluster them, generate theme names via Mistral AI. This is a read-only endpoint that does NOT create themes -- the user taps "Add" to create.

### No Schema Changes Required

Both endpoints query existing models (Theme, ContentTheme, Card, Content, Tag). No new Prisma models or migrations needed for v3.0.

---

## Data Flow Diagram: Full v3.0 Architecture

```
                          +-----------------+
                          |   Font Loading  |
                          |  (app/_layout)  |
                          |  Geist fonts    |
                          | StatusBar light |
                          +--------+--------+
                                   |
                    +--------------+--------------+
                    |                             |
            +-------+-------+            +-------+-------+
            |  Glass TabBar |            |  Stack Screens |
            | (custom blur) |            | (unchanged nav)|
            +---+---+---+---+            +-------+-------+
                |   |   |   |                    |
      +---------+   |   |   +--------+    /theme/[id]
      |             |   |            |    /quiz/[id]
  +---+---+   +----+---+  +----+----+  +---+----+    /memo/[id]
  | Home  |   |Explorer|  |Revisions|  |Profile |    /content/[id]
  +---+---+   +---+----+  +----+----+  +---+----+
      |           |             |           |
      |     +-----+-----+      |           |
      |     | Suggest |Lib|     |     useAuthStore
      |     +-----+-----+      |     useOAuthStatus
      |           |             |
  useDailyThemes  |       useReviews (extended)
  useReviewStats  |
  useThemes       useSuggestions
                  useContentList (existing)
                  useInbox (existing)
```

---

## Integration Points Summary

### Files: NEW

| File | Purpose |
|------|---------|
| `ios/theme/tokens.ts` | All design tokens (replaces `theme.ts`) |
| `ios/theme/index.ts` | Barrel re-export for backward compatibility |
| `ios/components/ui/glass/GlassSurface.tsx` | Foundation glass component |
| `ios/components/ui/glass/GlassCard.tsx` | Glass card component |
| `ios/components/ui/glass/GlassButton.tsx` | Glass button component |
| `ios/components/ui/glass/GlassInput.tsx` | Glass input component |
| `ios/components/ui/glass/GlassTabBar.tsx` | Custom glass tab bar |
| `ios/components/ui/glass/index.ts` | Glass barrel export |
| `ios/components/icons/Icon.tsx` | Lucide icon wrapper |
| `ios/components/icons/TabIcon.tsx` | Tab bar icons |
| `ios/components/icons/PlatformIcon.tsx` | Platform icons |
| `ios/components/icons/index.ts` | Icons barrel export |
| `ios/app/(tabs)/explorer.tsx` | Explorer screen (new tab) |
| `ios/hooks/useDaily.ts` | Daily themes hook |
| `ios/hooks/useSuggestions.ts` | Theme suggestions hook |

### Files: MODIFIED

| File | Change |
|------|--------|
| `ios/theme.ts` | DELETE (replaced by `theme/` directory) |
| `ios/components/ui/Text.tsx` | Geist fontFamily, color values auto-updated via tokens |
| `ios/components/ui/Button.tsx` | Add 'glass' variant, colors auto-updated |
| `ios/components/ui/Card.tsx` | Colors auto-updated via tokens |
| `ios/components/ui/Input.tsx` | Colors auto-updated via tokens |
| `ios/components/ui/Badge.tsx` | Colors auto-updated via tokens |
| `ios/components/ui/Skeleton.tsx` | Pulse color auto-updated via tokens |
| `ios/components/ui/Toast.tsx` | Colors auto-updated via tokens |
| `ios/components/ui/index.ts` | Add Glass* exports |
| `ios/components/ThemeCard.tsx` | Restyle with glass treatment |
| `ios/app/_layout.tsx` | Font loading (useFonts), StatusBar, SafeAreaProvider |
| `ios/app/(tabs)/_layout.tsx` | New tab structure + custom tabBar |
| `ios/app/(tabs)/index.tsx` | Rewrite: Home screen |
| `ios/app/(tabs)/reviews.tsx` | Rewrite: Revisions with filter/search |
| `ios/app/(tabs)/profile.tsx` | Night Blue restyle |
| `ios/hooks/index.ts` | Export new hooks |
| `ios/types/content.ts` | Add DailyTheme, ThemeSuggestion types |
| `backend/src/routes/themes.ts` | Add daily + suggestions endpoints |

### Files: DELETE

| File | Reason |
|------|--------|
| `ios/theme.ts` | Replaced by `ios/theme/` directory |
| `ios/app/(tabs)/library.tsx` | Merged into `explorer.tsx` |

### Files: UNCHANGED

| File | Reason |
|------|--------|
| All hooks (useThemes, useContent, useQuiz, useReviews, useMemo, useOAuth) | Data layer, no visual dependencies |
| All stores (authStore, contentStore) | State management, no visuals |
| All lib/ files (api.ts, constants.ts, queryClient.ts, storage.ts) | Infrastructure layer |
| All backend files except themes.ts | No visual concerns |
| All quiz components | Restyle via tokens only, no structural change |
| All stack screens (theme/[id], content/[id], quiz/[id], memo/[id]) | Restyle via tokens, no structural change |

---

## Patterns to Follow

### Pattern 1: Token-First Styling

Every color, font, spacing, and effect value comes from tokens. No hardcoded values in components.

**What:** Import design tokens, never use raw hex/number values.
**When:** Always.
**Example:**
```typescript
// GOOD
import { colors, glass, spacing } from '../../theme';
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceElevated, padding: spacing.md },
});

// BAD
const styles = StyleSheet.create({
  card: { backgroundColor: '#1E293B', padding: 12 },
});
```

### Pattern 2: Glass Component Composition

Use `GlassSurface` as the base, compose higher-level glass components on top.

**What:** Never use `BlurView` directly in screens. Always use `GlassSurface` or its derivatives.
**When:** Any glass effect needed.
**Why:** Centralizes BlurView configuration. If we need to adjust intensity, border, or tint across all glass surfaces, one file changes.

### Pattern 3: Existing Component Restyling via Token Swap

When the current `Card` component references `colors.surface`, changing `colors.surface` from `#FAFAFA` to `#111827` in tokens automatically reskins it. No component code changes needed for basic palette swap.

**What:** Rely on token value changes for reskinning, not component rewrites.
**When:** Basic components (Card, Button, Input, Badge, Skeleton).
**Exception:** Components needing structural changes (ThemeCard gets glass treatment, Feed gets rewritten).

### Pattern 4: Font Loading at Root

Load Geist fonts once in `app/_layout.tsx` using `useFonts` from `@expo-google-fonts/geist`. Show splash/loading until fonts are loaded. Then `Text.tsx` references font family names from tokens.

```typescript
// app/_layout.tsx
import { useFonts, Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  if (!fontsLoaded) return <LoadingScreen />;

  // ... rest of layout
}
```

### Pattern 5: Icon Component Abstraction

Wrap Lucide icons in a single `Icon` component that applies theme-aware defaults (color, size). This replaces emoji usage across the app.

```typescript
// components/icons/Icon.tsx
import { colors } from '../../theme';
import { type LucideIcon } from 'lucide-react-native';

interface IconProps {
  icon: LucideIcon;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ icon: LucideIcon, size = 24, color = colors.text, strokeWidth = 1.5 }: IconProps) {
  return <LucideIcon size={size} color={color} strokeWidth={strokeWidth} />;
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: ThemeProvider / React Context for Design Tokens

**What:** Creating a React Context with a ThemeProvider that wraps the app and provides tokens via `useTheme()` hook.
**Why bad:** The app has only ONE theme (Night Blue). There is no light/dark toggle, no user-selectable themes. A Context adds re-render overhead and boilerplate for zero benefit. The current static import pattern (`import { colors } from '../../theme'`) is simpler and faster.
**Instead:** Keep static imports. If dark/light toggle is ever needed (v4+), THEN add a Context. Do not over-engineer.

### Anti-Pattern 2: Using GlassEffect (iOS 26+ only)

**What:** Using Expo's new `GlassEffect` component for glass surfaces.
**Why bad:** GlassEffect requires iOS 26+. The app targets Expo SDK 54 which supports iOS 16+. Most users will NOT be on iOS 26. `expo-blur` `BlurView` works on all iOS versions and is the correct choice.
**Instead:** Use `BlurView` from `expo-blur` with `intensity` and `tint` props.

### Anti-Pattern 3: Stacking Multiple BlurViews

**What:** Having BlurView in tab bar + BlurView in each card + BlurView in header = 10+ blur layers on screen.
**Why bad:** GPU-intensive. Each BlurView renders as a separate composition layer. On older devices, this causes frame drops and battery drain.
**Instead:** Use BlurView sparingly: tab bar (1), modal backgrounds (1 at a time), selected hero cards (1-3). Regular cards use opaque `surfaceElevated` color, not blur.

### Anti-Pattern 4: Breaking Import Paths

**What:** Renaming `theme.ts` to something else or restructuring exports so all 15+ files need import changes.
**Why bad:** Creates a massive diff, high merge conflict risk, and no functional benefit.
**Instead:** Replace `theme.ts` file with `theme/` directory. Metro resolves `../../theme` to `../../theme/index.ts` automatically. Zero import path changes needed.

### Anti-Pattern 5: Migrating Library Tab Functionality into Explorer Before Design Tokens

**What:** Building the Explorer screen (with Suggestions + Library tabs) before the design system tokens and glass components are in place.
**Why bad:** You'd build the Explorer screen twice -- once with old styles, then restyle it. Waste of effort.
**Instead:** Build order must be: tokens -> glass components -> screen restructure.

### Anti-Pattern 6: Emoji Icons Alongside Lucide

**What:** Using Lucide icons in some places and emoji in others.
**Why bad:** Visual inconsistency. Emoji render differently across iOS versions, are not color-controllable, and cannot match the stroke weight of Lucide icons.
**Instead:** Replace ALL emoji icons in a single pass: tab bar, platform indicators, content cards, theme cards, empty states.

---

## Scalability Considerations

| Concern | Current (light theme) | v3.0 (Night Blue) | Future (multi-theme) |
|---------|----------------------|--------------------|-----------------------|
| Token system | Flat file, static imports | Flat file, static imports (same) | React Context + `useTheme()` hook |
| Glass performance | N/A | 3-5 BlurViews max per screen | Same limit |
| Font loading | System font (0ms) | Geist loaded via useFonts (~200ms) | Same |
| Icon rendering | Emoji (text rendering) | Lucide SVG (tree-shaken) | Same |
| Tab bar | Default Expo Tabs | Custom glass tab bar | Same custom implementation |
| Color scheme | Light only | Dark only | `useColorScheme()` + token variants |

---

## Suggested Build Order (Dependencies)

Build order is strictly dependency-driven. Each phase can be deployed independently.

```
Phase 1: Design Tokens + Font Setup
  - Create theme/ directory with tokens.ts and index.ts
  - Delete old theme.ts (Metro resolves automatically)
  - Install @expo-google-fonts/geist
  - Add font loading to app/_layout.tsx
  - Add StatusBar style='light'
  - Update app.json splash backgroundColor to #0A0F1A
  Dependencies: None
  Risk: LOW (pure value changes, backward-compatible imports)
  Verify: App renders with dark background, Geist fonts loaded

Phase 2: Icon System
  - Install lucide-react-native + react-native-svg
  - Create components/icons/ (Icon, TabIcon, PlatformIcon)
  Dependencies: Phase 1 (needs colors from tokens)
  Risk: LOW
  Verify: Icons render at correct size/color

Phase 3: Glass Components
  - Install expo-blur (if not already)
  - Create components/ui/glass/ (GlassSurface, GlassCard, GlassButton, GlassInput, GlassTabBar)
  - Update components/ui/index.ts to export glass components
  Dependencies: Phase 1 (needs glass tokens)
  Risk: LOW-MEDIUM (BlurView behavior needs testing on device)
  Verify: GlassCard renders with blur effect on physical device

Phase 4: Existing Component Restyling
  - Update Text.tsx (Geist fontFamily references)
  - Update Button.tsx (add 'glass' variant)
  - Verify Card, Input, Badge, Skeleton, Toast auto-restyled via token swap
  - Update ThemeCard with glass treatment
  - Replace emoji TabIcon with Lucide TabIcon
  Dependencies: Phase 1, Phase 2, Phase 3
  Risk: LOW (mostly verifying auto-reskin works)

Phase 5: Tab Restructure + Screen Rewrites
  - Rename library.tsx -> explorer.tsx
  - Rewrite _layout.tsx with new tabs + GlassTabBar
  - Rewrite index.tsx (Home: daily themes, stats)
  - Build explorer.tsx (Suggestions + Library tabs)
  - Rewrite revisions.tsx (cards, filters, search)
  - Restyle profile.tsx
  Dependencies: Phase 1-4 (all design system components ready)
  Risk: MEDIUM (most complex, multiple screens)

Phase 6: Backend Endpoints
  - Add GET /api/themes/daily to themes.ts
  - Add GET /api/themes/suggestions to themes.ts
  - Create useDaily.ts and useSuggestions.ts hooks
  - Wire hooks into Home and Explorer screens
  Dependencies: Can run in parallel with Phase 3-4 (backend is independent)
  Risk: LOW (lightweight query endpoints, no schema changes)
```

---

## Sources

- [Expo BlurView Documentation](https://docs.expo.dev/versions/latest/sdk/blur-view/) -- BlurView props, platform support, performance notes
- [Expo GlassEffect Documentation](https://docs.expo.dev/versions/latest/sdk/glass-effect/) -- iOS 26+ only, NOT suitable for SDK 54
- [Expo Fonts Documentation](https://docs.expo.dev/develop/user-interface/fonts/) -- useFonts hook, font loading patterns
- [@expo-google-fonts/geist on npm](https://www.npmjs.com/package/@expo-google-fonts/geist) -- Geist font package for Expo
- [Lucide React Native](https://lucide.dev/guide/packages/lucide-react-native) -- Icon library setup and usage
- [Expo Color Themes](https://docs.expo.dev/develop/user-interface/color-themes/) -- Dark mode / StatusBar handling
- [Expo System Bars](https://docs.expo.dev/develop/user-interface/system-bars/) -- StatusBar style for dark backgrounds
- Direct codebase analysis of all relevant iOS and backend files (theme.ts, 8 UI components, 4 tab screens, _layout.tsx, hooks, stores, types, backend themes.ts)
