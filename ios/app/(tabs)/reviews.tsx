/**
 * Reviews Tab - List of quizzed contents (one card per content, no session duplicates)
 */

import { useCallback, useRef, useState, useMemo } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet, Pressable, Alert, TextInput } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Search, Trash2, X, Check } from 'lucide-react-native';
import { SessionCard } from '../../components/reviews/SessionCard';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { Text } from '../../components/ui';
import { useCompletedSessions, useDeleteContentReviews, useDebouncedValue } from '../../hooks';
import type { QuizSessionTheme, QuizSessionItem } from '../../hooks';
import { colors, spacing, borderRadius, fonts, glass, depth } from '../../theme';
import { STAGGER_DELAY, STAGGER_CAP } from '../../lib/animations';

const HEADER_HEIGHT = 108;

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

  // Total header height (safe area + header content)
  const totalHeaderHeight = topInset + HEADER_HEIGHT;

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

  // --- Unified header with search + theme filters ---
  const renderUnifiedHeader = () => (
    <View style={[styles.unifiedHeader, { paddingTop: topInset }]}>
      {/* Solid background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={18} color={colors.textSecondary} strokeWidth={1.5} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une fiche..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            keyboardAppearance="dark"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <X size={18} color={colors.textSecondary} strokeWidth={1.5} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Theme filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {/* "Tout" pill */}
        <Pressable
          style={[styles.themePill, selectedThemeIds.length === 0 && styles.themePillActive]}
          onPress={() => setSelectedThemeIds([])}
        >
          <Text
            variant="caption"
            weight={selectedThemeIds.length === 0 ? 'medium' : 'regular'}
            style={[styles.themePillLabel, selectedThemeIds.length === 0 && styles.themePillLabelActive]}
          >
            Tout
          </Text>
        </Pressable>

        {availableThemes.map((theme) => {
          const isActive = selectedThemeIds.includes(theme.id);
          return (
            <Pressable
              key={theme.id}
              style={[styles.themePill, isActive && styles.themePillActive]}
              onPress={() => setSelectedThemeIds((prev) =>
                prev.includes(theme.id) ? prev.filter((t) => t !== theme.id) : [...prev, theme.id]
              )}
            >
              <Text
                variant="caption"
                weight={isActive ? 'medium' : 'regular'}
                style={[styles.themePillLabel, isActive && styles.themePillLabelActive]}
                numberOfLines={1}
              >
                {theme.name}
              </Text>
              {isActive && <Check size={12} color={colors.background} strokeWidth={3} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

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
    <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + spacing.lg }]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textSecondary}
          />
        }
      >
        {/* Spacer for fixed header */}
        <View style={{ height: totalHeaderHeight }} />

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

      {/* Fixed unified header */}
      {renderUnifiedHeader()}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // --- Unified header (search + filters) ---
  unifiedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingBottom: spacing.xs,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    height: 40,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: glass.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.text,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  themePillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  themePillLabel: {
    color: colors.text,
    fontSize: 13,
  },
  themePillLabelActive: {
    color: colors.background,
  },

  // --- List ---
  list: {
    paddingHorizontal: spacing.md,
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
