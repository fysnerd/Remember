/**
 * Library Tab - Browse all content + Triage mode via button
 *
 * Default: Browse mode showing all non-archived content (INBOX with "Nouveau" badge,
 * processing with pipeline badge, READY normal). Filterable by platform + theme.
 *
 * Triage: Activated via "Trier" button, uses SwipeCardStack for inbox items.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, FlatList, ScrollView, StyleSheet, RefreshControl, Dimensions, ActivityIndicator, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { Text } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { ContentCard, SourcePills, SwipeCardStack, TriageModeToggle } from '../../components/content';
import { ThemePills } from '../../components/reviews/ThemePills';
import { SearchInput } from '../../components/explorer/SearchInput';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { Search, PartyPopper, X, BookOpen } from 'lucide-react-native';
import { useLibraryContent, useInbox, useInboxCount, useSwipeTriage, useDebouncedValue, useThemes } from '../../hooks';
import { useContentStore } from '../../stores/contentStore';
import type { Content } from '../../types/content';
import { colors, spacing } from '../../theme';
import api from '../../lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = spacing.sm;
const GRID_PADDING = spacing.lg;
const COLUMN_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

export default function LibraryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const [refreshing, setRefreshing] = useState(false);
  const autoSwitchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Store state
  const {
    searchQuery,
    setSearchQuery,
    sourceFilter,
    setSourceFilter,
    themeFilter,
    setThemeFilter,
    viewMode,
    setViewMode,
  } = useContentStore();

  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Data fetching
  const { data: inboxCount } = useInboxCount();
  const { data: themes } = useThemes();
  const {
    data: libraryItems,
    isLoading: libraryLoading,
    fetchNextPage: libraryFetchNextPage,
    hasNextPage: libraryHasNextPage,
    isFetchingNextPage: libraryFetchingNextPage,
  } = useLibraryContent({
    source: sourceFilter,
    themeId: themeFilter ?? undefined,
    search: debouncedSearch || undefined,
    excludeArchived: true,
  });

  // Triage data (only when in triage mode)
  const {
    data: inboxItems,
    isLoading: inboxLoading,
    fetchNextPage: inboxFetchNextPage,
    hasNextPage: inboxHasNextPage,
    isFetchingNextPage: inboxFetchingNextPage,
  } = useInbox(sourceFilter);

  const swipeTriage = useSwipeTriage();
  const { show: showToast, ToastComponent } = useToast();

  // Theme pills data
  const themeOptions = useMemo(() => {
    if (!themes) return [];
    return themes.map((t) => ({
      id: t.id,
      name: t.name,
      emoji: t.emoji || '📚',
    }));
  }, [themes]);

  // Filter inbox items for triage mode
  const filteredInboxItems = useMemo(() => {
    return inboxItems ?? [];
  }, [inboxItems]);

  // Auto-switch back to browse when triage completes
  useEffect(() => {
    if (viewMode === 'triage' && filteredInboxItems.length === 0 && !inboxLoading) {
      autoSwitchTimer.current = setTimeout(() => {
        showToast('Tout est trie !', 'success');
        setViewMode('browse');
      }, 1500);
    }
    return () => {
      if (autoSwitchTimer.current) clearTimeout(autoSwitchTimer.current);
    };
  }, [viewMode, filteredInboxItems.length, inboxLoading]);

  // Pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    api.post('/content/refresh').catch(() => {});
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['content'] }),
      queryClient.invalidateQueries({ queryKey: ['inbox'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  // --- Swipe handlers ---
  const handleSwipeRight = useCallback((item: Content) => {
    swipeTriage.mutate({ contentId: item.id, action: 'learn' });
    showToast('Contenu sauvegarde', 'success');
  }, [swipeTriage, showToast]);

  const handleSwipeLeft = useCallback((item: Content) => {
    swipeTriage.mutate({ contentId: item.id, action: 'archive' });
  }, [swipeTriage]);

  const handleSwipeEmpty = useCallback(() => {}, []);

  const handleNearEnd = useCallback(() => {
    if (inboxHasNextPage && !inboxFetchingNextPage) {
      inboxFetchNextPage();
    }
  }, [inboxHasNextPage, inboxFetchingNextPage, inboxFetchNextPage]);

  // --- Browse mode handlers ---
  const handleContentPress = useCallback((id: string) => {
    router.push(`/content/${id}`);
  }, [router]);

  const handleLibraryLoadMore = useCallback(() => {
    if (libraryHasNextPage && !libraryFetchingNextPage) {
      libraryFetchNextPage();
    }
  }, [libraryHasNextPage, libraryFetchingNextPage, libraryFetchNextPage]);

  // --- Mode switching ---
  const handleOpenTriage = useCallback(() => {
    setViewMode('triage');
  }, [setViewMode]);

  const handleCloseTriage = useCallback(() => {
    setViewMode('browse');
    queryClient.invalidateQueries({ queryKey: ['content', 'library'] });
  }, [setViewMode, queryClient]);

  // --- Render content card ---
  const renderContentItem = useCallback(({ item }: { item: Content }) => (
    <View style={styles.gridItem}>
      <ContentCard
        id={item.id}
        title={item.title}
        source={item.source}
        thumbnailUrl={item.thumbnailUrl}
        channelName={item.channelName}
        duration={item.duration}
        status={item.status}
        onPress={() => handleContentPress(item.id)}
      />
    </View>
  ), [handleContentPress]);

  // =====================================================
  // BROWSE MODE
  // =====================================================
  const renderBrowseMode = () => (
    <>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Source filter pills */}
      <SourcePills
        selectedSource={sourceFilter}
        onSourceChange={setSourceFilter}
      />

      {/* Theme filter pills */}
      {themeOptions.length > 0 && (
        <ThemePills
          themes={themeOptions}
          selectedThemeId={themeFilter}
          onThemeChange={setThemeFilter}
        />
      )}

      {/* Content grid */}
      {libraryLoading ? (
        <LoadingScreen />
      ) : !libraryItems?.length ? (
        <ScrollView
          contentContainerStyle={[styles.emptyContainer, { paddingBottom: tabBarHeight + spacing.lg }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
          }
        >
          {debouncedSearch ? (
            <EmptyState message="Aucun resultat" icon={Search} hasHeader />
          ) : (
            <EmptyState message="Aucun contenu pour le moment" icon={BookOpen} hasHeader />
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={libraryItems}
          renderItem={renderContentItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.lg }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
          }
          onEndReached={handleLibraryLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            libraryFetchingNextPage ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator color={colors.textSecondary} />
              </View>
            ) : null
          }
        />
      )}
    </>
  );

  // =====================================================
  // TRIAGE MODE
  // =====================================================
  const renderTriageMode = () => {
    // Source pills for filtering triage too
    const triageContent = (
      <>
        <SourcePills
          selectedSource={sourceFilter}
          onSourceChange={setSourceFilter}
        />

        {inboxLoading ? (
          <LoadingScreen />
        ) : !filteredInboxItems.length ? (
          <ScrollView
            contentContainerStyle={[styles.swipeEmptyContainer, { paddingBottom: tabBarHeight + spacing.lg }]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
            }
          >
            {sourceFilter !== 'all' ? (
              <EmptyState
                message={`Aucun contenu ${sourceFilter === 'youtube' ? 'YouTube' : sourceFilter === 'spotify' ? 'Spotify' : sourceFilter === 'tiktok' ? 'TikTok' : 'Instagram'} a trier`}
                icon={Search}
                hasHeader
              />
            ) : (
              <EmptyState
                message="Tout est trie !"
                icon={PartyPopper}
                hasHeader
              />
            )}
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.swipeScrollWrapper}
            bounces={true}
            scrollEnabled={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
            }
          >
            <SwipeCardStack
              key={sourceFilter}
              items={filteredInboxItems}
              onSwipeRight={handleSwipeRight}
              onSwipeLeft={handleSwipeLeft}
              onEmpty={handleSwipeEmpty}
              onNearEnd={handleNearEnd}
            />
          </ScrollView>
        )}
      </>
    );

    return triageContent;
  };

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
      {/* Header */}
      <View style={styles.topTabBar}>
        {viewMode === 'browse' ? (
          <>
            <Text variant="body" weight="medium" style={styles.topTabTextActive}>
              Bibliotheque
            </Text>
            <TriageModeToggle inboxCount={inboxCount ?? 0} onPress={handleOpenTriage} />
          </>
        ) : (
          <>
            <Text variant="body" weight="medium" style={styles.topTabTextActive}>
              Trier
            </Text>
            <Pressable
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
              onPress={handleCloseTriage}
              hitSlop={8}
            >
              <X size={20} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
          </>
        )}
      </View>

      {/* Mode content */}
      {viewMode === 'browse' ? renderBrowseMode() : renderTriageMode()}

      <ToastComponent />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // --- Header ---
  topTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  topTabTextActive: {
    color: colors.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },

  // --- Search ---
  searchContainer: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
  },

  // --- Swipe mode ---
  swipeScrollWrapper: {
    flex: 1,
  },
  swipeEmptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  // --- Content area ---
  content: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    flexGrow: 1,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  // --- Grid ---
  columnWrapper: {
    gap: GRID_GAP,
  },
  gridItem: {
    width: COLUMN_WIDTH,
  },
  loadingMore: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
