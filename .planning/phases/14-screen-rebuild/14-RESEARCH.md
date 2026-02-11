# Phase 14: Screen Rebuild - Research

**Researched:** 2026-02-11
**Domain:** React Native screen architecture (Expo SDK 54, expo-router, Glass UI)
**Confidence:** HIGH

## Summary

Phase 14 rebuilds the four main tab screens (Home, Explorer, Revisions, Profile) using the Glass UI design system established in Phase 13. The work is purely frontend -- all screens rewrite existing files using existing components (GlassCard, GlassButton, GlassInput, GlassSurface) and existing data hooks (useThemes, useContentList, useCompletedItems, useReviewStats, useOAuthStatus, etc.).

The critical constraint is that Phase 15 (backend endpoints for daily themes and AI suggestions) runs in parallel and is NOT yet available. The Home screen's "3 daily themes" and Explorer's "8 AI suggestions" requirements depend on endpoints that do not exist yet. The planner must design screens that degrade gracefully when these endpoints are not wired -- using existing theme data as placeholders until Phase 15 delivers.

**Primary recommendation:** Rebuild screens in 3 plans (Home, Explorer, Revisions+Profile), using existing hooks and data where endpoints exist, and creating stub hooks with TODO comments for the 2 missing Phase 15 endpoints (GET /api/themes/daily, GET /api/themes/suggestions). Wire real data when Phase 15 ships.

## Standard Stack

### Core (Already Installed -- No New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-router | SDK 54 | File-based routing, tab navigation | Already in use, defines screen structure |
| @tanstack/react-query | v5 | Server state, caching, refetch | Already powering all data hooks |
| zustand | v4 | Client state (filters, tabs) | Already in contentStore.ts |
| expo-blur (BlurView) | SDK 54 | Glass UI surfaces | Established in Phase 13 |
| lucide-react-native | latest | All icons | Established in Phase 13 |
| @react-navigation/bottom-tabs | SDK 54 | useBottomTabBarHeight | Already used in all tab screens |

### Supporting (Already Available)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-native-safe-area-context | SDK 54 | SafeAreaView for full-screen states | EmptyState, ErrorState already use it |
| expo-haptics | SDK 54 | Haptic feedback on interactions | Deferred to Phase 16 |

### No New Dependencies Required

This phase requires **zero** new npm packages. Everything needed is already installed.

**Installation:**
```bash
# Nothing to install -- all dependencies exist from Phase 12/13
```

## Architecture Patterns

### Current Screen File Structure
```
ios/app/(tabs)/
  _layout.tsx    # Tab navigator with glass blur bar
  index.tsx      # Home (currently "Feed") -- REWRITE
  library.tsx    # Explorer (currently "Bibliotheque") -- REWRITE
  reviews.tsx    # Revisions (currently "Memos") -- REWRITE
  profile.tsx    # Profile -- REWRITE
```

### Recommended Component Extraction
```
ios/components/
  home/
    DailyThemeCard.tsx     # GlassCard with theme info (NEW)
    GreetingHeader.tsx     # Time-of-day greeting + stats (NEW)
  explorer/
    SuggestionCard.tsx     # GlassCard for AI suggestion (NEW)
    GlassTabBar.tsx        # Suggestions | Library toggle (NEW, reuse glass style)
    SearchInput.tsx        # GlassInput-based search bar (NEW)
  reviews/
    RevisionCard.tsx       # GlassCard for revision item (NEW)
    CategoryChips.tsx      # Filter chips row (NEW)
  # Keep existing components:
  content/
    ContentCard.tsx        # KEEP -- already styled
    FilterBar.tsx          # KEEP -- already styled
    SourcePills.tsx        # KEEP -- already styled
    SelectionBar.tsx       # KEEP -- already styled
  glass/
    GlassSurface.tsx       # KEEP
    GlassCard.tsx          # KEEP
    GlassButton.tsx        # KEEP
    GlassInput.tsx         # KEEP
```

### Pattern 1: Screen Skeleton with Glass UI

**What:** Every tab screen follows a consistent structure: SafeAreaView wrapper, ScrollView with RefreshControl, paddingBottom from useBottomTabBarHeight, GlassCard-based layouts.

**When to use:** All 4 tab screens.

**Example:**
```typescript
// Source: Current codebase pattern (ios/app/(tabs)/index.tsx)
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { colors, spacing } from '../../theme';

export default function HomeScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const [refreshing, setRefreshing] = useState(false);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: tabBarHeight + spacing.lg }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
      }
    >
      {/* GlassCard-based content */}
    </ScrollView>
  );
}
```

### Pattern 2: DailyThemeCard using GlassCard

**What:** Theme cards on the Home screen use GlassCard (blur surface) instead of the current opaque ThemeCard.

**When to use:** Home screen's 3 daily theme cards.

**Example:**
```typescript
// Source: Composition of GlassCard (ios/components/glass/GlassCard.tsx) + ThemeCard props
import { GlassCard } from '../glass/GlassCard';
import { Text } from '../ui';
import { colors, spacing } from '../../theme';

interface DailyThemeCardProps {
  name: string;
  emoji: string;
  color: string;
  contentCount: number;
  questionCount: number;
  onPress: () => void;
}

function DailyThemeCard({ name, emoji, color, contentCount, questionCount, onPress }: DailyThemeCardProps) {
  return (
    <GlassCard padding="lg" onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Text style={{ fontSize: 32 }}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text variant="h3">{name}</Text>
          <Text variant="caption" color="secondary">
            {contentCount} contenus · {questionCount} questions
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}
```

### Pattern 3: Tab Toggle with Glass Styling

**What:** The Explorer screen has a Suggestions | Library toggle. Use the same underline-tab pattern from the current library.tsx but apply Glass styling.

**When to use:** Explorer screen tab toggle.

**Example:**
```typescript
// Source: Current library.tsx tab implementation adapted for glass style
<View style={styles.tabBar}>
  <Pressable style={styles.tab} onPress={() => setTab('suggestions')}>
    <Text variant="body" weight={tab === 'suggestions' ? 'medium' : 'regular'}>
      Suggestions
    </Text>
    {tab === 'suggestions' && <View style={[styles.tabIndicator, { backgroundColor: colors.accent }]} />}
  </Pressable>
  {/* ... Library tab ... */}
</View>
```

### Pattern 4: Search with GlassInput

**What:** Full-text search on Library and Revisions screens uses GlassInput with search icon and debounced query.

**When to use:** Explorer Library tab search, Revisions screen search.

**Example:**
```typescript
// Source: GlassInput composition + debounce pattern
const [searchText, setSearchText] = useState('');
const debouncedSearch = useDebouncedValue(searchText, 300);

// Use debouncedSearch in query key
const { data } = useContentList({ ...filters, search: debouncedSearch || undefined });
```

### Anti-Patterns to Avoid

- **Creating new data-fetching hooks when backend endpoints don't exist:** Use existing hooks (useThemes, useContentList, etc.) and create STUB hooks for daily themes / AI suggestions with clear TODO markers. Do NOT create fake data generators.
- **Re-implementing components that already exist:** The FilterBar, ContentCard, SourcePills, SelectionBar components are already Night Blue styled (Phase 13). Reuse them, don't rebuild.
- **Mixing Glass and non-Glass cards on the same screen:** Use GlassCard consistently within each screen. Don't mix old Card and new GlassCard in the same view.
- **Hardcoding colors or fonts:** Always use theme.ts tokens (colors, spacing, fonts, borderRadius, glass).
- **Forgetting paddingBottom for tab bar:** Every tab screen MUST use `useBottomTabBarHeight()` since the tab bar is position: absolute with Glass blur.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blur surfaces | Custom blur overlay | GlassSurface / GlassCard | Already handles overflow:hidden, borderRadius, shadow |
| Debounced search | Manual setTimeout | useDebouncedValue custom hook (simple) | Consistent debounce pattern across screens |
| Pull-to-refresh | Custom gesture handler | ScrollView RefreshControl | Native iOS feel, already used in all screens |
| Tab bar height | Magic number (e.g., 80px) | useBottomTabBarHeight() | Adapts to device, already wired |
| Platform-specific icons | Conditional icon rendering | PlatformIcon component | Already maps platform string to Lucide icon |
| Filter state persistence | Local useState | useContentStore (Zustand) | Already manages library tab state, extend for new screens |

**Key insight:** Phase 14 is a screen REWRITE, not a component library build. The building blocks exist. The work is composing existing primitives into the new information architecture.

## Common Pitfalls

### Pitfall 1: Backend Endpoints Don't Exist Yet

**What goes wrong:** Planner creates tasks that depend on GET /api/themes/daily and GET /api/themes/suggestions, which are Phase 15 deliverables.
**Why it happens:** SCREEN-01 ("3 daily themes") and SCREEN-02 ("8 AI suggestions") sound like they need dedicated backend endpoints.
**How to avoid:** Create screens that use existing data as interim source. For daily themes: use `useThemes()` and pick the top 3 by dueCards (descending). For suggestions: show a placeholder state with "Coming soon" or use existing pending themes. Create stub hooks (useDailyThemes, useThemeSuggestions) that wrap existing hooks now and will be rewired to Phase 15 endpoints later.
**Warning signs:** TypeScript errors referencing non-existent API routes, 404s on app load.

### Pitfall 2: Tab Navigation Renaming

**What goes wrong:** Renaming tab files changes the expo-router route structure, breaking deep links and navigation.
**Why it happens:** Current tabs are index.tsx ("Feed"), library.tsx ("Bibliotheque"), reviews.tsx ("Memos"), profile.tsx. The new IA calls them "Home", "Explorer", "Revisions", "Profile".
**How to avoid:** Keep the same file names (index.tsx, library.tsx, reviews.tsx, profile.tsx) and only change the display title in _layout.tsx. expo-router uses file names as route segments -- renaming would break navigation.
**Warning signs:** Navigation crashes, "Route not found" errors.

### Pitfall 3: Losing Existing Functionality During Rewrite

**What goes wrong:** The library.tsx rewrite loses triage functionality (collection/triage tabs, batch selection, SelectionBar).
**Why it happens:** The new "Explorer" IA has Suggestions + Library tabs which is different from Collection + Triage.
**How to avoid:** The Library tab within Explorer must preserve the existing triage functionality. The Collection/Triage toggle moves inside the Library tab or becomes its own filter. Don't delete the SelectionBar, batch triage, or inbox count badge.
**Warning signs:** Users can no longer triage inbox items after the rebuild.

### Pitfall 4: Scroll Performance with Many GlassCards

**What goes wrong:** Rendering many BlurView-backed GlassCards causes frame drops.
**Why it happens:** Each GlassCard contains a BlurView which is a native view overlay. 20+ on screen simultaneously can cause GPU pressure.
**How to avoid:** For long lists (Library content, Revisions), consider using FlatList instead of ScrollView + map. GlassCard works fine for small cardinality sections (3 daily themes, 8 suggestions) but a FlatList with windowSize tuning is better for lists of 20+ items.
**Warning signs:** Choppy scrolling, dropped frames on older devices.

### Pitfall 5: Missing Greeting Personalization Data

**What goes wrong:** Home screen greeting says "Bonjour, undefined!" because user.name is optional.
**Why it happens:** The User type has `name?: string`, and many users signed up with email-only (no name).
**How to avoid:** Fallback chain: user.name || user email prefix (before @) || "there". The authStore already stores user data with optional name field.
**Warning signs:** Greeting showing "undefined" or blank.

### Pitfall 6: Search API Already Supports Full-Text

**What goes wrong:** Developer builds client-side search instead of using backend search.
**Why it happens:** Not knowing the backend already supports `?search=term` query parameter.
**How to avoid:** The content route (`GET /api/content`) already accepts `search` parameter that searches title, description, and transcript text (case-insensitive). Use it via the existing `useContentList` hook by adding a `search` field to the filters object.
**Warning signs:** Search only matching visible items, not finding items by transcript content.

## Code Examples

### Existing Hooks Available for Each Screen

#### Home Screen (index.tsx)
```typescript
// Already available:
import { useThemes } from '../../hooks';         // All user themes
import { useReviewStats } from '../../hooks';     // dueToday, streak
import { useAuthStore } from '../../stores/authStore'; // user.name, user.email

// Needs Phase 15 (stub for now):
// useDailyThemes() -> wraps useThemes() + sorts by dueCards desc, takes 3
// useThemeSuggestions() -> placeholder/empty until Phase 15
```

#### Explorer Screen (library.tsx)
```typescript
// Already available for Library tab:
import { useContentList, useTriageMutation } from '../../hooks';
import { useInbox, useInboxCount } from '../../hooks';
import { useTopics, useChannels } from '../../hooks';
import { useContentStore } from '../../stores/contentStore';

// Needs Phase 15 (stub for now):
// useThemeSuggestions() -> placeholder/empty until Phase 15
```

#### Revisions Screen (reviews.tsx)
```typescript
// Already available:
import { useCompletedItems, useReviewStats } from '../../hooks';
// Backend GET /api/reviews already returns { items, topics }
// Backend GET /api/content already supports ?search= for full-text search
```

#### Profile Screen (profile.tsx)
```typescript
// Already available:
import { useAuthStore } from '../../stores/authStore';
import { useOAuthStatus } from '../../hooks';
// Backend PATCH /api/users/profile for name update
// Backend GET /api/reviews/settings for review settings
// Backend PATCH /api/reviews/settings for updating settings
```

### Backend API Endpoints That Exist

| Endpoint | Response | Used By |
|----------|----------|---------|
| `GET /api/themes` | `{ themes: ThemeListItem[] }` | Home (daily themes stub) |
| `GET /api/themes?status=pending` | `{ themes: ThemeListItem[] }` | Home (discovery banner) |
| `GET /api/content?search=X&platform=Y&tags=Z` | `{ contents, pagination }` | Explorer Library tab |
| `GET /api/content/inbox` | `{ contents, pagination }` | Explorer Library triage |
| `GET /api/content/inbox/count` | `{ count }` | Explorer badge |
| `GET /api/content/tags` | `TagResponse[]` | Explorer filters |
| `GET /api/content/channels` | `Channel[]` | Explorer filters |
| `GET /api/reviews` | `{ items, topics }` | Revisions list |
| `GET /api/reviews/stats` | `ReviewStats` | Home stats, Revisions header |
| `GET /api/auth/me` | `{ user }` | Profile info |
| `GET /api/oauth/status` | OAuthStatus | Profile platforms |
| `GET /api/reviews/settings` | Settings | Profile settings |
| `PATCH /api/reviews/settings` | Settings | Profile settings update |
| `PATCH /api/users/profile` | User | Profile name update |

### Backend API Endpoints That DON'T Exist Yet (Phase 15)

| Endpoint | Expected Response | Workaround for Phase 14 |
|----------|-------------------|------------------------|
| `GET /api/themes/daily` | `{ themes: ThemeListItem[] }` (3 items) | Use `useThemes()`, sort by `dueCards` desc, take first 3 |
| `GET /api/themes/suggestions` | `{ suggestions: ThemeSuggestion[] }` (8 items) | Show EmptyState or "Bientot disponible" placeholder |

### Debounce Hook Pattern
```typescript
// Simple debounce hook for search
import { useState, useEffect } from 'react';

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
```

### Content Search Hook Extension
```typescript
// Extend existing useContentList to support search
// Current implementation in useContent.ts already maps `search` to query params
// Just need to pass it through filters:
const filters = {
  source: sourceFilter !== 'all' ? sourceFilter : undefined,
  topic: topicFilter || undefined,
  channel: channelFilter || undefined,
  search: debouncedSearch || undefined, // NEW: add search term
};
const { data } = useContentList(filters);
```

Note: The backend `GET /api/content` already supports `?search=` parameter for full-text search across title, description, and transcript. However, the `useContentList` hook currently does not pass a `search` parameter. This needs to be wired up by adding `search` to the `ContentFilters` interface and appending `params.append('search', filters.search)` in the hook.

## State of the Art

| Old Approach (Current) | New Approach (Phase 14) | Impact |
|------------------------|------------------------|--------|
| Opaque Card components with solid backgrounds | GlassCard with BlurView frost | Premium, depth-aware UI |
| "Feed" tab showing all themes in 2-column grid | "Home" tab with 3 daily themes + greeting + stats | Focused daily learning experience |
| Library with Collection/Triage tabs | Explorer with Suggestions/Library tabs | Discovery-first, then library browsing |
| Reviews showing flat content list | Revisions with category filter chips + search | Faster navigation to specific revision material |
| Profile with just platforms + logout | Profile with user info + editable name + settings | More complete user management |

## Open Questions

1. **Daily Themes Selection Logic (before Phase 15)**
   - What we know: SCREEN-01 requires "3 daily themes" in glass cards. Phase 15 will build `GET /api/themes/daily` with smart rotation.
   - What's unclear: How to select 3 themes from existing data as interim. Options: (a) sort by dueCards desc, (b) sort by last interaction, (c) random 3.
   - Recommendation: Sort by `dueCards` descending (most urgent to review first), then by `updatedAt` desc. This gives meaningful interim behavior that aligns with the Phase 15 intent.

2. **Suggestions Tab Placeholder**
   - What we know: SCREEN-02 requires "8 AI-generated theme suggestions". Phase 15 builds this endpoint.
   - What's unclear: What to show in the Suggestions tab before Phase 15 delivers.
   - Recommendation: Show an EmptyState with a Sparkles icon and message "Des suggestions personnalisees arrivent bientot" (personalized suggestions coming soon). This is honest UI -- no fake data.

3. **Explorer Tab Naming (Information Architecture)**
   - What we know: Current library.tsx has Collection | A trier. New IA wants Suggestions | Library.
   - What's unclear: Does "Library" in the new IA include the triage/inbox functionality, or is triage removed?
   - Recommendation: Library tab should include triage. Within the Library tab, keep the Collection/Triage sub-toggle. This preserves existing functionality while adding the Suggestions tab. The tab_layout title changes from "Bibliotheque" to "Explorer".

4. **Revisions Category Filter Source**
   - What we know: SCREEN-04 requires "category filter chips".
   - What's unclear: What categories to filter by -- platforms (YouTube/Spotify/TikTok/Instagram), content types, or themes?
   - Recommendation: Use platform-based filter chips (matching the existing SourcePills pattern) plus a search bar. This reuses existing UI components and backend filters. Theme-based filtering could be added as secondary chips.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: ios/app/(tabs)/*.tsx -- all 4 current tab screens read and analyzed
- Codebase analysis: ios/components/glass/*.tsx -- all Glass UI components read
- Codebase analysis: ios/hooks/*.ts -- all data hooks read
- Codebase analysis: ios/stores/*.ts -- all Zustand stores read
- Codebase analysis: ios/theme.ts -- design token system read
- Codebase analysis: ios/types/content.ts -- all TypeScript interfaces read
- Codebase analysis: backend/src/routes/content.ts -- full content API with search support verified
- Codebase analysis: backend/src/routes/themes.ts -- themes API verified
- Codebase analysis: backend/src/routes/review.ts -- reviews API verified
- Codebase analysis: backend/src/routes/user.ts -- user profile/settings API verified
- Phase 13 verification report: All design system components confirmed working

### Secondary (MEDIUM confidence)
- .planning/ROADMAP.md -- Phase 14/15/16 descriptions and dependencies
- .planning/REQUIREMENTS.md -- SCREEN-01 through SCREEN-05 requirements

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, everything already installed and verified
- Architecture: HIGH -- direct codebase analysis of all existing screens, hooks, and components
- Pitfalls: HIGH -- derived from reading current implementation and identifying delta to requirements
- API coverage: HIGH -- read all backend routes, confirmed which endpoints exist vs. need Phase 15

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (stable stack, no fast-moving dependencies)
