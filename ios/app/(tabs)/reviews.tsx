/**
 * Reviews Tab - List of quizzed contents (one card per content, no session duplicates)
 */

import { useCallback, useRef, useState, useMemo } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet, Pressable, Alert } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Search, Trash2 } from 'lucide-react-native';
import { SessionCard } from '../../components/reviews/SessionCard';
import { SearchInput } from '../../components/explorer/SearchInput';
import { ThemePills } from '../../components/reviews/ThemePills';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { Text } from '../../components/ui';
import { useCompletedSessions, useDeleteContentReviews, useDebouncedValue } from '../../hooks';
import type { QuizSessionTheme, QuizSessionItem } from '../../hooks';
import { colors, spacing, borderRadius } from '../../theme';
import { STAGGER_DELAY, STAGGER_CAP } from '../../lib/animations';

/** One entry per unique content (deduplicated from sessions) */
interface MemoItem {
  contentId: string;
  title: string;
  platform: string;
  thumbnailUrl: string | null;
  channelName: string | null;
  themes: QuizSessionTheme[];
}

/** Deduplicate sessions → one entry per content */
function deduplicateByContent(sessions: QuizSessionItem[]): MemoItem[] {
  const contentMap = new Map<string, MemoItem>();

  for (const session of sessions) {
    for (const content of session.contents) {
      if (contentMap.has(content.id)) continue;
      contentMap.set(content.id, {
        contentId: content.id,
        title: content.title,
        platform: content.platform,
        thumbnailUrl: content.thumbnailUrl,
        channelName: content.channelName,
        themes: session.themes,
      });
    }
  }

  return Array.from(contentMap.values());
}

export default function ReviewsScreen() {
  const router = useRouter();
  const { bottom: bottomInset, top: topInset } = useSafeAreaInsets();
  const tabBarHeight = bottomInset + 49;
  const queryClient = useQueryClient();
  const { data: sessions, isLoading } = useCompletedSessions();
  const deleteContent = useDeleteContentReviews();
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);

  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Deduplicate sessions into unique content items
  const memoItems = useMemo(() => {
    if (!sessions) return [];
    return deduplicateByContent(sessions);
  }, [sessions]);

  const handleDelete = useCallback((contentId: string, title: string) => {
    Alert.alert(
      'Supprimer cette fiche',
      `Supprimer "${title}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel', onPress: () => swipeableRefs.current.get(contentId)?.close() },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => deleteContent.mutate(contentId),
        },
      ],
    );
  }, [deleteContent]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['reviews', 'sessions'] });
    setRefreshing(false);
  }, [queryClient]);

  // Extract unique themes from all items for the pills
  const availableThemes = useMemo(() => {
    const themeMap = new Map<string, QuizSessionTheme>();
    for (const item of memoItems) {
      for (const theme of item.themes) {
        if (!themeMap.has(theme.id)) {
          themeMap.set(theme.id, theme);
        }
      }
    }
    return Array.from(themeMap.values());
  }, [memoItems]);

  // Filter items by theme + search
  const filteredItems = useMemo(() => {
    let result = memoItems;

    if (selectedThemeIds.length > 0) {
      result = result.filter((item) =>
        item.themes.some((t) => selectedThemeIds.includes(t.id))
      );
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((item) =>
        item.title.toLowerCase().includes(q) ||
        item.channelName?.toLowerCase().includes(q) ||
        item.themes.some((t) => t.name.toLowerCase().includes(q))
      );
    }

    return result;
  }, [memoItems, selectedThemeIds, debouncedSearch]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!sessions || sessions.length === 0) {
    return (
      <EmptyState
        message="Aucune révision pour le moment. Faites un quiz pour commencer !"
        icon={FileText}
        hasHeader
      />
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(200)} style={[styles.container, { paddingTop: topInset }]}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Rechercher une fiche..."
        />
      </View>

      {/* Theme filter pills */}
      <ThemePills
        themes={availableThemes}
        selectedThemeIds={selectedThemeIds}
        onThemeToggle={(id) => setSelectedThemeIds((prev) =>
          prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
        )}
        onClearAll={() => setSelectedThemeIds([])}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: tabBarHeight + spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textSecondary}
          />
        }
      >
        {filteredItems.length > 0 ? (
          <View style={styles.list}>
            {filteredItems.map((item, index) => (
              <Animated.View
                key={item.contentId}
                entering={FadeInDown.delay(Math.min(index, STAGGER_CAP) * STAGGER_DELAY).duration(200)}
              >
                <Swipeable
                  ref={(ref) => {
                    if (ref) swipeableRefs.current.set(item.contentId, ref);
                    else swipeableRefs.current.delete(item.contentId);
                  }}
                  renderRightActions={() => (
                    <Pressable
                      style={styles.deleteAction}
                      onPress={() => handleDelete(item.contentId, item.title)}
                    >
                      <Trash2 size={18} color="#FFFFFF" />
                      <Text style={styles.deleteText}>Supprimer</Text>
                    </Pressable>
                  )}
                  overshootRight={false}
                  rightThreshold={40}
                >
                  <SessionCard
                    session={{
                      id: item.contentId,
                      completedAt: '',
                      totalCount: 0,
                      correctCount: 0,
                      accuracy: 0,
                      hasMemo: false,
                      contents: [{
                        id: item.contentId,
                        title: item.title,
                        platform: item.platform,
                        thumbnailUrl: item.thumbnailUrl,
                        channelName: item.channelName,
                      }],
                      themes: item.themes,
                    }}
                    onPress={() => {
                      router.push({ pathname: '/memo/[id]' as any, params: { id: item.contentId } });
                    }}
                  />
                </Swipeable>
              </Animated.View>
            ))}
          </View>
        ) : (
          <EmptyState
            message="Aucun résultat pour cette recherche"
            icon={Search}
            hasHeader
          />
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  deleteAction: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginLeft: spacing.sm,
    gap: 4,
  },
  deleteText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
