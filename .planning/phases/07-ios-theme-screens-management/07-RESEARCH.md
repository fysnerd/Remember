# Phase 7: iOS Theme Screens & Management - Research

**Researched:** 2026-02-10
**Domain:** Expo Router (file-based navigation), React Native UI components, TanStack React Query, Zustand state management
**Confidence:** HIGH

## Summary

Phase 7 is a purely frontend (iOS/Expo) phase that replaces the current tag-based "Topics" grid on the home screen with theme-based navigation, and adds management screens for renaming, deleting, creating, and reassigning content between themes. The backend API is fully ready -- Phase 5 delivered all theme CRUD endpoints (`GET /api/themes`, `GET /api/themes/:id`, `POST /api/themes`, `PUT /api/themes/:id`, `DELETE /api/themes/:id`, `POST /api/themes/:id/content`, `DELETE /api/themes/:id/content/:contentId`) and the content endpoints already return a `themes` array on each content item (flattened from `contentThemes` join data).

The existing iOS codebase follows clear, consistent patterns: expo-router file-based routing, TanStack React Query for data fetching with `useQuery`/`useMutation` hooks in `ios/hooks/`, Zustand for local UI state in `ios/stores/`, and a refined wireframe aesthetic (black/white/gray, system fonts, minimal shadows). The current home screen (`ios/app/(tabs)/index.tsx`) displays a 2-column grid of topic name strings with no metadata. Theme cards will replace this grid, adding emoji, color, and content count. The current topic detail screen (`ios/app/topic/[name].tsx`) and topic manage screen (`ios/app/topic/manage/[name].tsx`) serve as direct templates for the new theme equivalents, which will route by theme ID rather than tag name.

No new npm dependencies are needed. The TypeScript types need extending to include a `Theme` interface. React Query hooks for themes follow the exact same pattern as `useTopics.ts`. The key UI work is designing the `ThemeCard` component (emoji + name + color accent + content count in a 2-column grid), the theme detail screen (paginated content list with platform filter), and the management screens (rename, delete, create, content reassignment). All patterns already exist in the codebase.

**Primary recommendation:** Follow existing codebase patterns exactly. Create a `useThemes.ts` hook file mirroring `useTopics.ts`. Add `Theme` and `ThemeListItem` types to `types/content.ts`. Replace the Topics grid in `index.tsx` with ThemeCard components. Create new screens under `ios/app/theme/[id].tsx` and `ios/app/theme/manage/[id].tsx`. Reuse existing UI components (Card, Button, Text, TopicChip, ContentCard) and design tokens (colors, spacing, borderRadius from `theme.ts`).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-router | SDK 54 | File-based routing for theme screens | Already in use, all routing is file-based |
| @tanstack/react-query | (installed) | Data fetching, caching, mutations for themes API | Already in use for content, topics, reviews |
| zustand | (installed) | Local UI state (e.g., selected theme filter) | Already in use for content store |
| axios | (installed) | HTTP client (wrapped in `lib/api.ts`) | Already in use with interceptors for JWT auth |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-native | (installed) | Core UI primitives (View, ScrollView, Pressable, RefreshControl, Alert, Modal, TextInput, FlatList) | All screen components |
| react-native-safe-area-context | (installed) | Safe area insets for EmptyState | Already in use |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ScrollView for theme detail | FlatList | FlatList is better for long lists (virtualizes); use FlatList when content count > 20 items. ScrollView fine for theme list (max 25 themes). |
| Alert for confirmations | Custom Modal | Alert is simpler and matches existing delete-confirm pattern in `topic/manage/[name].tsx`. Use custom Modal only if more complex UI needed. |
| Theme color as left border accent | Theme color as full background | Full background would clash with the wireframe aesthetic (black/white/gray). A color accent (left border or small pill) is more subtle and fits the design language. |

**Installation:**
```bash
# No new packages needed -- all dependencies already exist
```

## Architecture Patterns

### Recommended Project Structure
```
ios/
├── app/
│   ├── (tabs)/
│   │   └── index.tsx              # MODIFIED: Replace Topics grid with ThemeCard grid
│   ├── theme/
│   │   ├── [id].tsx               # NEW: Theme detail screen (content list)
│   │   └── manage/
│   │       └── [id].tsx           # NEW: Theme management (rename, delete, content reassignment)
│   ├── theme-create.tsx           # NEW: Manual theme creation screen (or modal)
│   └── _layout.tsx                # MODIFIED: Add Stack.Screen entries for theme routes
├── hooks/
│   ├── useThemes.ts               # NEW: Theme CRUD hooks (list, detail, create, update, delete, add/remove content)
│   └── index.ts                   # MODIFIED: Export new theme hooks
├── types/
│   └── content.ts                 # MODIFIED: Add Theme, ThemeListItem types
├── components/
│   ├── ThemeCard.tsx              # NEW: Theme card component (emoji + name + color + count)
│   └── ThemeContentAssigner.tsx   # NEW: Modal for assigning content to themes (optional, could be inline)
└── stores/
    └── contentStore.ts            # MODIFIED: (minimal, if theme-specific filter state needed)
```

### Pattern 1: Theme Data Fetching Hooks (Mirroring useTopics.ts)
**What:** React Query hooks wrapping the `/api/themes` endpoints, following the exact pattern of `useTopics.ts`.
**When to use:** Every screen that needs theme data.
**Example:**
```typescript
// ios/hooks/useThemes.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { ThemeListItem, ThemeDetail } from '../types/content';

// GET /api/themes -- list themes with content counts
export function useThemes() {
  return useQuery({
    queryKey: ['themes'],
    queryFn: async (): Promise<ThemeListItem[]> => {
      const { data } = await api.get<{ themes: ThemeListItem[] }>('/themes');
      return data.themes;
    },
  });
}

// GET /api/themes/:id -- theme detail with paginated content
export function useThemeDetail(id: string, page = 1, platform?: string) {
  return useQuery({
    queryKey: ['themes', id, page, platform],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (platform) params.append('platform', platform);
      const { data } = await api.get(`/themes/${id}?${params}`);
      return data; // { theme, contents, pagination }
    },
    enabled: !!id,
  });
}

// POST /api/themes -- create theme
export function useCreateTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; color?: string; emoji?: string }) => {
      const { data } = await api.post('/themes', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
    },
  });
}

// PUT /api/themes/:id -- update theme (rename, color, emoji)
export function useUpdateTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; name?: string; color?: string; emoji?: string }) => {
      const { data } = await api.put(`/themes/${id}`, body);
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      queryClient.invalidateQueries({ queryKey: ['themes', id] });
    },
  });
}

// DELETE /api/themes/:id -- delete theme (preserves content)
export function useDeleteTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/themes/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
    },
  });
}

// POST /api/themes/:id/content -- add content to theme
export function useAddContentToTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ themeId, contentIds }: { themeId: string; contentIds: string[] }) => {
      const { data } = await api.post(`/themes/${themeId}/content`, { contentIds });
      return data;
    },
    onSuccess: (_, { themeId }) => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      queryClient.invalidateQueries({ queryKey: ['themes', themeId] });
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
}

// DELETE /api/themes/:id/content/:contentId -- remove content from theme
export function useRemoveContentFromTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ themeId, contentId }: { themeId: string; contentId: string }) => {
      const { data } = await api.delete(`/themes/${themeId}/content/${contentId}`);
      return data;
    },
    onSuccess: (_, { themeId }) => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      queryClient.invalidateQueries({ queryKey: ['themes', themeId] });
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
}
```

### Pattern 2: TypeScript Types for Theme API Responses
**What:** Types matching the backend API response shapes. The backend returns `themes` as a flat array on content items.
**When to use:** Everywhere theme data is consumed.
**Example:**
```typescript
// In ios/types/content.ts
export interface ThemeListItem {
  id: string;
  name: string;
  slug: string;
  color: string;       // hex color e.g. "#6366F1"
  emoji: string;       // e.g. "📚"
  contentCount: number;
  tags: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface ThemeRef {
  id: string;
  name: string;
  slug: string;
  color: string;
  emoji: string;
}

// Update Content interface to include themes
export interface Content {
  // ... existing fields ...
  themes?: ThemeRef[];  // From backend contentThemes flatten
}
```

### Pattern 3: ThemeCard Component Design
**What:** A card component for the home screen grid, displaying theme emoji, name, color accent, and content count.
**When to use:** Home screen (index.tsx) theme grid.
**Design spec:**
- 2-column grid (same layout as current Topics grid)
- Each card: left color border (4px, theme color), emoji on left, name centered, content count as caption
- Background: `colors.surface` (matches wireframe aesthetic)
- On press: navigate to `theme/[id]`
**Example:**
```typescript
// ios/components/ThemeCard.tsx
import { Pressable, View, StyleSheet } from 'react-native';
import { Text } from './ui';
import { colors, spacing, borderRadius, shadows } from '../theme';

interface ThemeCardProps {
  id: string;
  name: string;
  emoji: string;
  color: string;
  contentCount: number;
  onPress: () => void;
}

export function ThemeCard({ name, emoji, color, contentCount, onPress }: ThemeCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.colorBar, { backgroundColor: color }]} />
      <View style={styles.content}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text variant="body" weight="medium" numberOfLines={2} style={styles.name}>
          {name}
        </Text>
        <Text variant="caption" color="secondary">
          {contentCount} contenu{contentCount !== 1 ? 's' : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    flexDirection: 'row',
    ...shadows.sm,
  },
  pressed: { opacity: 0.7 },
  colorBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  name: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
});
```

### Pattern 4: Expo Router Screen Registration
**What:** New screen files under `ios/app/theme/` registered in `_layout.tsx` root Stack.
**When to use:** Every new screen added to the app.
**Example:**
```typescript
// In ios/app/_layout.tsx, add:
<Stack.Screen
  name="theme/[id]"
  options={{
    headerShown: true,
    headerBackTitle: 'Feed',
    presentation: 'card',
  }}
/>
<Stack.Screen
  name="theme/manage/[id]"
  options={{
    headerShown: true,
    title: 'Gerer le theme',
    headerBackTitle: 'Retour',
    presentation: 'card',
  }}
/>
<Stack.Screen
  name="theme-create"
  options={{
    headerShown: true,
    title: 'Nouveau theme',
    presentation: 'modal',
  }}
/>
```

### Pattern 5: Content-to-Theme Mapping in Frontend
**What:** The iOS content hooks currently map backend `tags` to `topics: string[]`. Need to also map `themes` from the backend response to the Content type.
**When to use:** When updating `useContent.ts` and `useContentList` to include theme data.
**Example:**
```typescript
// Update mapContent() in ios/hooks/useContent.ts
function mapContent(item: BackendContent): Content {
  return {
    // ... existing fields ...
    topics: item.tags?.map((t) => t.name) ?? [],
    themes: item.themes ?? [],  // Already flat from backend
  };
}

// Update BackendContent interface to include themes
interface BackendContent {
  // ... existing fields ...
  themes?: { id: string; name: string; slug: string; color: string; emoji: string }[];
}
```

### Pattern 6: Pull-to-Refresh Pattern (Already Established)
**What:** The pull-to-refresh pattern using `RefreshControl` with `queryClient.invalidateQueries()`.
**When to use:** Home screen and theme detail screen (NAV-05).
**Example:**
```typescript
// Exactly as done in index.tsx today:
const onRefresh = useCallback(async () => {
  setRefreshing(true);
  await queryClient.invalidateQueries({ queryKey: ['themes'] });
  setRefreshing(false);
}, [queryClient]);

// In theme detail:
const onRefresh = useCallback(async () => {
  setRefreshing(true);
  await queryClient.invalidateQueries({ queryKey: ['themes', themeId] });
  setRefreshing(false);
}, [queryClient, themeId]);
```

### Anti-Patterns to Avoid
- **Fetching themes inside the content list hook:** Theme list and content list are separate concerns. Use `useThemes()` for the home screen grid, not `useContentList()`.
- **Routing by theme name/slug instead of ID:** Unlike the existing `/topic/[name]` which uses tag name strings, themes have unique IDs. Route by ID (`/theme/[id]`) for unambiguous navigation, especially since theme names can be renamed.
- **Duplicating the topic management pattern for themes without adapting it:** The existing `topic/manage/[name].tsx` works with tag names (strings). Theme management works with theme IDs and has more operations (rename, delete, create, color/emoji editing, content assignment). The pattern is similar but the data flow is different.
- **Putting theme CRUD logic in Zustand:** Theme data is server-sourced. Use React Query for all CRUD operations (matching existing patterns). Zustand is only for local UI state (which tab is active, filter selections).
- **Hardcoding the theme color palette in the frontend:** The color comes from the backend (stored in the Theme model). The frontend displays whatever color the backend provides.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data fetching/caching | Custom fetch + state | TanStack React Query hooks | Already in use, handles caching, refetching, invalidation |
| Navigation | Custom navigation stack | expo-router file-based routing | Already in use, just add new files |
| Theme card layout | Custom grid system | `flexDirection: 'row', flexWrap: 'wrap', gap` pattern | Exact same pattern used in current Topics grid |
| Delete confirmation | Custom confirmation modal | `Alert.alert()` with destructive option | Exact same pattern in `topic/manage/[name].tsx` |
| Loading states | Custom spinners | `<LoadingScreen />` component | Already exists and is used everywhere |
| Empty states | Custom empty views | `<EmptyState />` component | Already exists with icon + message pattern |
| Pull-to-refresh | Custom pull detection | `<RefreshControl />` | Already used in index.tsx and library.tsx |
| Form inputs | Custom input components | `<TextInput>` with existing styles | Pattern from `topic/manage/[name].tsx` |

**Key insight:** This phase introduces zero new technical patterns. Every UI pattern, data fetching pattern, and navigation pattern already exists in the codebase. The work is purely screen composition -- assembling existing building blocks into new screens.

## Common Pitfalls

### Pitfall 1: iOS Content Hook Not Parsing Theme Data
**What goes wrong:** The `mapContent()` function in `useContent.ts` ignores the `themes` array from the backend, so content detail screens don't show theme associations.
**Why it happens:** The backend was updated in Phase 5 to include `themes` in content responses, but the frontend `BackendContent` interface and `mapContent()` were never updated.
**How to avoid:** Update `BackendContent` interface to include `themes?: ThemeRef[]` and `mapContent()` to pass it through. This is a required change for Phase 7.
**Warning signs:** Content detail screen shows no theme chips even though the backend returns them.

### Pitfall 2: Query Key Collisions Between Topics and Themes
**What goes wrong:** Invalidating `['topics']` also invalidates theme queries or vice versa.
**Why it happens:** If theme hooks accidentally use `['topics']` as part of their query key.
**How to avoid:** Use `['themes']` as the query key prefix for all theme hooks. Keep `['topics']` for the existing tag-based hooks. They are independent.
**Warning signs:** Theme list re-fetches when topics change, or topics list re-fetches when themes change.

### Pitfall 3: Theme Detail Screen N+1 for Content
**What goes wrong:** Fetching theme detail and then individually fetching each content item.
**Why it happens:** The backend `GET /api/themes/:id` already returns paginated content in a single response. No need for separate content fetches.
**How to avoid:** Use the `useThemeDetail(id)` hook which returns `{ theme, contents, pagination }` in one call. The contents array includes tags, quiz counts, etc.
**Warning signs:** Multiple API calls visible in network logs when opening a theme detail screen.

### Pitfall 4: Forgetting to Register New Screens in _layout.tsx
**What goes wrong:** New theme screens show blank or crash with navigation errors.
**Why it happens:** expo-router requires screens to be both files in the `app/` directory AND registered in the `_layout.tsx` Stack.
**How to avoid:** For every new screen file created, add a corresponding `<Stack.Screen name="...">` entry in `_layout.tsx`.
**Warning signs:** "No route named X" errors in the console.

### Pitfall 5: Stale Theme Data After Mutations
**What goes wrong:** After renaming/deleting a theme, the home screen still shows the old data.
**Why it happens:** Forgetting to invalidate the `['themes']` query key in mutation `onSuccess`.
**How to avoid:** Every mutation hook (create, update, delete, add/remove content) must call `queryClient.invalidateQueries({ queryKey: ['themes'] })` in `onSuccess`. Follow the pattern from `useTopics.ts`.
**Warning signs:** Theme list doesn't update until manual pull-to-refresh.

### Pitfall 6: Theme Color Not Rendering Correctly
**What goes wrong:** Theme colors display as black or invisible because the hex string is malformed or applied incorrectly.
**Why it happens:** Backend stores colors as `#RRGGBB` strings. If the frontend tries to use them as backgroundColor on a dark surface, they may be invisible.
**How to avoid:** Use theme color as a small accent (left border, pill, dot) rather than full background. Verify hex format with a simple regex check before rendering.
**Warning signs:** All theme cards look the same despite having different colors in the database.

### Pitfall 7: Theme Management Screen Navigating Back to Wrong Place
**What goes wrong:** After deleting a theme from the manage screen, the app navigates back to the (now non-existent) theme detail screen, causing an error.
**Why it happens:** Using `router.back()` after delete instead of `router.replace()` to the home tab.
**How to avoid:** After deleting a theme, use `router.replace('/(tabs)')` to go back to the home screen (same pattern as `topic/manage/[name].tsx`).
**Warning signs:** Error screen or blank page after deleting a theme.

### Pitfall 8: Content Reassignment Between Themes Too Complex
**What goes wrong:** Trying to build a multi-select, multi-theme assignment UI that's overly complex for the user.
**Why it happens:** Content can belong to multiple themes (many-to-many). Building a full matrix editor is tempting.
**How to avoid:** Keep the UI simple: on the theme detail screen, show a "remove from theme" action per content item. On the content detail screen, show current themes as chips with "add to theme" and "remove" actions. Use a bottom sheet or modal with the list of user's themes to add to.
**Warning signs:** Users confused by the assignment UI, excessive number of taps to complete an action.

## Code Examples

Verified patterns from existing codebase:

### Home Screen Replacement (Topics -> Themes)
```typescript
// In ios/app/(tabs)/index.tsx
// Replace:
const { data: topics, isLoading: topicsLoading } = useTopics();
// With:
const { data: themes, isLoading: themesLoading } = useThemes();

// Replace topic grid with theme grid:
{themes.map((theme) => (
  <ThemeCard
    key={theme.id}
    id={theme.id}
    name={theme.name}
    emoji={theme.emoji}
    color={theme.color}
    contentCount={theme.contentCount}
    onPress={() => router.push({ pathname: '/theme/[id]', params: { id: theme.id } })}
  />
))}
```

### Theme Detail Screen Structure
```typescript
// ios/app/theme/[id].tsx -- follows pattern from topic/[name].tsx
export default function ThemeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useThemeDetail(id!);

  // data = { theme, contents, pagination }
  const theme = data?.theme;
  const contents = data?.contents ?? [];

  return (
    <>
      <Stack.Screen options={{
        title: theme?.name ?? '',
        headerRight: () => (
          <Pressable onPress={() => router.push(`/theme/manage/${id}`)}>
            <Text variant="h2">gear-icon</Text>
          </Pressable>
        ),
      }} />
      <ScrollView refreshControl={<RefreshControl ... />}>
        {/* Theme header: emoji + name + content count */}
        {/* Content list */}
        {/* Quiz button */}
      </ScrollView>
    </>
  );
}
```

### Theme Management Screen Structure
```typescript
// ios/app/theme/manage/[id].tsx -- follows pattern from topic/manage/[name].tsx
export default function ThemeManageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data } = useThemeDetail(id!);
  const updateTheme = useUpdateTheme();
  const deleteTheme = useDeleteTheme();
  const removeContent = useRemoveContentFromTheme();

  // Rename section (TextInput + save button)
  // Emoji/color picker (optional, can use preset palette)
  // Content list with remove buttons
  // Danger zone: delete theme button
}
```

### Content Detail Theme Chips
```typescript
// In ios/app/content/[id].tsx -- add theme section
// After the Topics section:
{content.themes && content.themes.length > 0 && (
  <View style={styles.section}>
    <Text variant="body" weight="medium" style={styles.sectionTitle}>
      Themes
    </Text>
    <View style={styles.topics}>
      {content.themes.map((theme) => (
        <Pressable
          key={theme.id}
          onPress={() => router.push(`/theme/${theme.id}`)}
          style={[styles.themeChip, { borderColor: theme.color }]}
        >
          <Text variant="caption">{theme.emoji} {theme.name}</Text>
        </Pressable>
      ))}
    </View>
  </View>
)}
```

### Theme Create Form (Modal or Screen)
```typescript
// Simple create form following existing patterns
const [name, setName] = useState('');
const createTheme = useCreateTheme();

const handleCreate = async () => {
  if (!name.trim()) return;
  try {
    await createTheme.mutateAsync({ name: name.trim() });
    router.back();
  } catch (error) {
    Alert.alert('Erreur', 'Impossible de creer le theme.');
  }
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tag name strings as navigation | Theme ID-based navigation | This phase (new) | More robust routing, supports rename without breaking links |
| Topics grid (plain text, no metadata) | Theme cards (emoji + color + count) | This phase (new) | Richer visual hierarchy, better discoverability |
| Manual topic management only | Themes as primary navigation + management | This phase (new) | Topics remain for fine-grained tagging; themes for high-level navigation |

**Important design note:** The existing Topics system is NOT removed. Themes are a layer above tags. The home screen replaces the Topics grid with Themes grid, but the Library tab's FilterBar still supports topic/tag filtering. Content detail still shows both topics (tags) and themes.

## Backend API Reference (Already Deployed)

The following endpoints are available from Phase 5:

| Method | Route | Request Body | Response | Notes |
|--------|-------|-------------|----------|-------|
| GET | `/api/themes` | -- | `{ themes: ThemeListItem[] }` | Sorted by name, includes contentCount and tags |
| GET | `/api/themes/:id` | Query: `page`, `limit`, `platform` | `{ theme, contents, pagination }` | Paginated content, optional platform filter |
| POST | `/api/themes` | `{ name, color?, emoji? }` | Theme object | 201 on success, 409 on duplicate slug, 400 on cap exceeded |
| PUT | `/api/themes/:id` | `{ name?, color?, emoji? }` | Updated theme | 409 on duplicate slug |
| DELETE | `/api/themes/:id` | -- | `{ message }` | Cascade deletes ContentTheme/ThemeTag, NOT content |
| POST | `/api/themes/:id/content` | `{ contentIds: string[] }` | `{ message, added }` | Skip duplicates, assignedBy: 'user' |
| DELETE | `/api/themes/:id/content/:contentId` | -- | `{ message }` | Removes join record only |

Content endpoints already include themes:
- `GET /api/content` returns `themes: ThemeRef[]` on each content item
- `GET /api/content/:id` returns `themes: ThemeRef[]` on the content detail

## Open Questions

1. **Emoji picker for theme creation/editing**
   - What we know: Backend accepts any emoji string (max 4 chars). Theme creation screen needs emoji input.
   - What's unclear: Should we use a full emoji picker component or a simple preset palette of ~20 relevant emojis?
   - Recommendation: Use a preset palette of ~20 emojis (e.g., books, music, brain, tech, sports, etc.) displayed as a horizontal scroll or grid. Simpler to implement, no new dependency, covers 95% of use cases. A full emoji keyboard can be added later if users request it.

2. **Color picker for theme creation/editing**
   - What we know: Backend accepts any hex color. The AI classification worker uses a palette of 12 colors.
   - What's unclear: Should users pick from the same 12-color palette, a broader palette, or a custom color picker?
   - Recommendation: Use the same 12-color palette from the AI worker (`#EF4444, #F97316, #EAB308, #22C55E, #14B8A6, #3B82F6, #6366F1, #8B5CF6, #EC4899, #F43F5E, #06B6D4, #84CC16`). Display as tappable color circles. Consistent with AI-generated themes, no custom color picker needed.

3. **FlatList vs ScrollView for theme detail content list**
   - What we know: Backend paginates content at 20 per page. A theme could have 50+ content items.
   - What's unclear: Is the current page load sufficient or should we implement infinite scroll?
   - Recommendation: Start with a simple ScrollView showing the first page (20 items) with a "Load more" button at the bottom. This matches the simplicity of the current codebase. FlatList with infinite scroll can be a follow-up optimization if needed.

4. **What happens to the existing `/topic/[name]` and `/topic/manage/[name]` screens?**
   - What we know: Requirement NAV-04 says "Theme list replaces current tag-based Topics as primary navigation." The home screen will use themes instead of topics.
   - What's unclear: Should the old topic screens be removed, or kept for backward compatibility?
   - Recommendation: Keep the old topic screens but remove the Topics grid from the home screen. The Library tab's FilterBar still links to topic-based content filtering. Topic screens become accessible only from the Library filter, not the home screen. This avoids breaking existing navigation while making themes the primary path.

5. **Content reassignment UI complexity**
   - What we know: MGMT-03 requires "User can move content between themes." Backend supports adding and removing content from themes individually.
   - What's unclear: What's the best UI pattern for this?
   - Recommendation: Two entry points: (a) From theme detail screen: swipe-to-delete or long-press to remove content from this theme. (b) From content detail screen: "Add to theme" button that opens a bottom sheet with the user's theme list (checkboxes for multi-theme support). This keeps each interaction focused and simple.

## Sources

### Primary (HIGH confidence)
- Existing iOS codebase analysis: `ios/app/(tabs)/index.tsx` (current home screen), `ios/app/topic/[name].tsx` (topic detail pattern), `ios/app/topic/manage/[name].tsx` (management pattern), `ios/hooks/useTopics.ts` (hook pattern), `ios/hooks/useContent.ts` (content fetching pattern), `ios/stores/contentStore.ts` (Zustand pattern), `ios/types/content.ts` (TypeScript types), `ios/theme.ts` (design tokens), `ios/components/ui/` (reusable UI components), `ios/app/_layout.tsx` (route registration)
- Backend API analysis: `backend/src/routes/themes.ts` (complete theme CRUD API), `backend/src/routes/content.ts` (content endpoints returning themes), `backend/prisma/schema.prisma` (Theme, ContentTheme, ThemeTag models)
- Phase 5 and Phase 6 research documents: Architecture decisions, API contracts, data model

### Secondary (MEDIUM confidence)
- expo-router documentation patterns (file-based routing, dynamic segments, Stack.Screen registration) -- verified by existing codebase usage

### Tertiary (LOW confidence)
- N/A -- all findings verified with direct codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies, all libraries already in use
- Architecture: HIGH -- Direct extension of established patterns (topic screens, content hooks)
- UI patterns: HIGH -- All UI components and design tokens already exist, just composing new screens
- Pitfalls: HIGH -- Based on real codebase patterns and identified data flow gaps

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain, Expo SDK 54 patterns well-established)
