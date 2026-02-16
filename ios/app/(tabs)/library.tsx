/**
 * Explorer Tab - Mes themes (grid) + Bibliotheque (inbox triage)
 *
 * Bibliotheque supports two triage modes:
 * - Swipe mode (default): SwipeCardStack for one-at-a-time triage
 * - Bulk mode: FlatList grid with multi-select and batch actions
 */

import { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, FlatList, StyleSheet, Pressable, RefreshControl, Dimensions, Alert, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Text, Badge, Skeleton } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { ContentCard, SourcePills, SelectionBar, SwipeCardStack, TriageModeToggle } from '../../components/content';
import { SearchInput } from '../../components/explorer/SearchInput';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { Search, BookOpen, Sparkles, PartyPopper } from 'lucide-react-native';
import { ThemeGridCard } from '../../components/explorer/ThemeGridCard';
import { GlassLockOverlay } from '../../components/glass';
import { useInbox, useInboxCount, useTriageMutation, useDebouncedValue, useThemes, useToggleFavoriteTheme, useDeleteTheme, useSwipeTriage } from '../../hooks';
import { useSubscription } from '../../hooks/useSubscription';
import { useContentStore } from '../../stores/contentStore';
import type { Content } from '../../types/content';
import { colors, spacing } from '../../theme';
import api from '../../lib/api';
import { STAGGER_DELAY, STAGGER_CAP } from '../../lib/animations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = spacing.sm;
const GRID_PADDING = spacing.lg;
const COLUMN_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

export default function LibraryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<'learn' | 'ignore' | null>(null);

  // Store state
  const {
    activeExplorerTab,
    setActiveExplorerTab,
    searchQuery,
    setSearchQuery,
    sourceFilter,
    setSourceFilter,
    triageMode,
    setTriageMode,
  } = useContentStore();

  // Subscription
  const { data: subscription } = useSubscription();
  const isFree = subscription?.plan !== 'PRO';

  // Debounce search for filtering (bulk mode only)
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Data fetching
  const { data: inboxCount } = useInboxCount();
  const { data: inboxItems, isLoading: inboxLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInbox(sourceFilter);
  const triageMutation = useTriageMutation();
  const swipeTriage = useSwipeTriage();
  const { data: themes, isLoading: themesLoading } = useThemes();
  const toggleFavoriteMutation = useToggleFavoriteTheme();
  const deleteThemeMutation = useDeleteTheme();

  const { show: showToast, ToastComponent } = useToast();
  const selectionMode = selectedIds.size > 0;

  // Filter inbox items by search (source filtering is done server-side)
  const filteredInboxItems = useMemo(() => {
    let items = inboxItems;
    if (!items) return items;
    // Only apply text search in bulk mode
    if (triageMode === 'bulk' && debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      items = items.filter((item) =>
        item.title.toLowerCase().includes(searchLower) ||
        (item.channelName && item.channelName.toLowerCase().includes(searchLower))
      );
    }
    return items;
  }, [inboxItems, debouncedSearch, triageMode]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Trigger platform sync in background (fire-and-forget)
    const syncEndpoint = sourceFilter === 'all'
      ? '/admin/sync/all'
      : `/admin/sync/${sourceFilter}`;
    api.post(syncEndpoint).catch(() => {});
    // Refresh local data immediately
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['inbox'] }),
      queryClient.invalidateQueries({ queryKey: ['themes'] }),
    ]);
    setRefreshing(false);
  }, [queryClient, sourceFilter]);

  // --- Swipe mode handlers ---
  const handleSwipeRight = useCallback((item: Content) => {
    swipeTriage.mutate({ contentId: item.id, action: 'learn' });
    showToast('Contenu sauvegarde', 'success');
  }, [swipeTriage, showToast]);

  const handleSwipeLeft = useCallback((item: Content) => {
    swipeTriage.mutate({ contentId: item.id, action: 'archive' });
  }, [swipeTriage]);

  const handleSwipeEmpty = useCallback(() => {
    // No-op: empty state is handled by checking filteredInboxItems length
  }, []);

  const handleNearEnd = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // --- Mode toggle ---
  const handleToggleMode = useCallback(() => {
    const newMode = triageMode === 'swipe' ? 'bulk' : 'swipe';
    setTriageMode(newMode);
    // Reset selection when switching to swipe mode
    if (newMode === 'swipe') {
      setSelectedIds(new Set());
    }
  }, [triageMode, setTriageMode]);

  // Toggle selection on tap (bulk mode)
  const handleToggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCancelSelection = () => {
    setSelectedIds(new Set());
  };

  // Batch triage (bulk mode)
  const handleBatchLearn = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const count = ids.length;
    setBatchAction('learn');
    triageMutation.mutate(
      { contentIds: ids, action: 'learn' },
      {
        onSuccess: () => {
          const msg = count === 1
            ? 'Contenu sauvegardé'
            : `${count} contenus sauvegardés`;
          showToast(msg, 'success');
        },
        onSettled: () => {
          setBatchAction(null);
          setSelectedIds(new Set());
        },
      }
    );
  };

  const handleBatchIgnore = () => {
    if (selectedIds.size === 0) return;
    setBatchAction('ignore');
    triageMutation.mutate(
      { contentIds: Array.from(selectedIds), action: 'archive' },
      {
        onSettled: () => {
          setBatchAction(null);
          setSelectedIds(new Set());
        },
      }
    );
  };

  const handleInboxItemPress = (id: string) => {
    handleToggleSelection(id);
  };

  const handleThemePress = (themeId: string) => {
    router.push({ pathname: '/theme/[id]' as any, params: { id: themeId } });
  };

  const handleThemeLongPress = (themeId: string, themeName: string) => {
    Alert.alert(
      'Supprimer le theme',
      `Voulez-vous supprimer "${themeName}" ? Les contenus ne seront pas supprimes.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => deleteThemeMutation.mutate(themeId),
        },
      ]
    );
  };

  // --- Render: Mes themes tab content (2-column grid) ---
  const renderThemesTab = () => {
    if (themesLoading) {
      return (
        <View style={styles.themesGrid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.themeGridItem}>
              <Skeleton height={100} width="100%" />
            </View>
          ))}
        </View>
      );
    }

    if (!themes?.length) {
      return (
        <EmptyState
          message="Triez du contenu pour decouvrir vos themes"
          icon={BookOpen}
          hasHeader
        />
      );
    }

    return (
      <ScrollView
        contentContainerStyle={[styles.themesContainer, { paddingBottom: tabBarHeight + spacing.lg }]}
      >
        <View style={styles.themesGrid}>
          {themes.map((theme, index) => (
            <Animated.View
              key={theme.id}
              style={styles.themeGridItem}
              entering={FadeInDown.delay(Math.min(index, STAGGER_CAP) * STAGGER_DELAY).duration(200)}
            >
              <GlassLockOverlay locked={isFree && index >= 2}>
                <ThemeGridCard
                  emoji={theme.emoji}
                  name={theme.name}
                  contentCount={theme.contentCount}
                  dueCards={theme.dueCards}
                  isFavorite={theme.isFavorite}
                  onPress={() => handleThemePress(theme.id)}
                  onLongPress={() => handleThemeLongPress(theme.id, theme.name)}
                  onToggleFavorite={() => toggleFavoriteMutation.mutate(theme.id)}
                />
              </GlassLockOverlay>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    );
  };

  // Render a single inbox card (for FlatList in bulk mode)
  const renderInboxItem = useCallback(({ item }: { item: Content }) => (
    <View style={styles.gridItem}>
      <ContentCard
        id={item.id}
        title={item.title}
        source={item.source}
        thumbnailUrl={item.thumbnailUrl}
        channelName={item.channelName}
        duration={item.duration}
        onPress={() => handleInboxItemPress(item.id)}
        isSelected={selectedIds.has(item.id)}
        selectionMode={true}
      />
    </View>
  ), [selectedIds]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // --- Render: Swipe mode ---
  const renderSwipeMode = () => {
    if (inboxLoading) {
      return <LoadingScreen />;
    }

    if (!filteredInboxItems?.length) {
      // Empty state with pull-to-refresh
      const isFiltered = sourceFilter !== 'all';
      const platformName = sourceFilter === 'youtube' ? 'YouTube'
        : sourceFilter === 'spotify' ? 'Spotify'
        : sourceFilter === 'tiktok' ? 'TikTok'
        : sourceFilter === 'instagram' ? 'Instagram'
        : '';

      return (
        <ScrollView
          contentContainerStyle={[styles.swipeEmptyContainer, { paddingBottom: tabBarHeight + spacing.lg }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
          }
        >
          {isFiltered ? (
            <EmptyState
              message={`Aucun contenu ${platformName} a trier`}
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
      );
    }

    // Swipe card stack with pull-to-refresh wrapper
    // ScrollView with flex: 1 contentContainer is non-scrollable but RefreshControl still works
    return (
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
    );
  };

  // --- Render: Bulk mode ---
  const renderBulkMode = () => (
    <>
      {/* Search bar (bulk mode only) */}
      <View style={styles.searchContainer}>
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {inboxLoading ? (
        <LoadingScreen />
      ) : !filteredInboxItems?.length ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.lg }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
          }
        >
          {sourceFilter !== 'all' ? (
            <EmptyState message={`Aucun contenu ${sourceFilter === 'youtube' ? 'YouTube' : sourceFilter === 'spotify' ? 'Spotify' : sourceFilter === 'tiktok' ? 'TikTok' : 'Instagram'} a trier`} icon={Search} hasHeader />
          ) : debouncedSearch && inboxItems?.length ? (
            <EmptyState message="Aucun resultat pour cette recherche" icon={Search} hasHeader />
          ) : (
            <EmptyState message="Rien a trier pour le moment" icon={Sparkles} hasHeader />
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={filteredInboxItems}
          renderItem={renderInboxItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: tabBarHeight + spacing.lg },
            selectionMode && styles.gridWithBar,
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <Text variant="caption" style={styles.instruction}>
              Selectionnez le contenu a garder
            </Text>
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator color={colors.textSecondary} />
              </View>
            ) : null
          }
        />
      )}
    </>
  );

  // --- Render: Bibliotheque tab content (swipe or bulk) ---
  const renderLibraryTab = () => (
    <>
      {/* Source filter pills (both modes) */}
      <SourcePills
        selectedSource={sourceFilter}
        onSourceChange={setSourceFilter}
      />

      {/* Mode-specific content */}
      {triageMode === 'swipe' ? renderSwipeMode() : renderBulkMode()}
    </>
  );

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
      {/* Top-level tabs: Suggestions | Bibliotheque + mode toggle */}
      <View style={styles.topTabBar}>
        <View style={styles.topTabGroup}>
          <Pressable
            style={styles.topTab}
            onPress={() => setActiveExplorerTab('suggestions')}
          >
            <Text
              variant="body"
              weight={activeExplorerTab === 'suggestions' ? 'medium' : 'regular'}
              style={activeExplorerTab === 'suggestions' ? styles.topTabTextActive : styles.topTabTextInactive}
            >
              Mes themes
            </Text>
            {activeExplorerTab === 'suggestions' && <View style={styles.topTabIndicator} />}
          </Pressable>
          <Pressable
            style={styles.topTab}
            onPress={() => setActiveExplorerTab('library')}
          >
            <View style={styles.topTabWithBadge}>
              <Text
                variant="body"
                weight={activeExplorerTab === 'library' ? 'medium' : 'regular'}
                style={activeExplorerTab === 'library' ? styles.topTabTextActive : styles.topTabTextInactive}
              >
                Bibliotheque
              </Text>
              {(inboxCount ?? 0) > 0 && <Badge count={inboxCount ?? 0} size="sm" />}
            </View>
            {activeExplorerTab === 'library' && <View style={styles.topTabIndicator} />}
          </Pressable>
        </View>

        {/* Triage mode toggle (only visible on library tab) */}
        {activeExplorerTab === 'library' && (
          <TriageModeToggle mode={triageMode} onToggle={handleToggleMode} />
        )}
      </View>

      {/* Tab content */}
      {activeExplorerTab === 'suggestions' ? renderThemesTab() : renderLibraryTab()}

      {/* Selection bar - appears when items selected in bulk triage mode */}
      {selectionMode && activeExplorerTab === 'library' && triageMode === 'bulk' && (
        <SelectionBar
          selectedCount={selectedIds.size}
          onLearn={handleBatchLearn}
          onIgnore={handleBatchIgnore}
          onCancel={handleCancelSelection}
          loadingLearn={batchAction === 'learn'}
          loadingIgnore={batchAction === 'ignore'}
        />
      )}
      <ToastComponent />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // --- Top-level tabs (Suggestions | Bibliotheque) ---
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
  topTabGroup: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  topTab: {
    paddingVertical: spacing.sm,
    position: 'relative',
  },
  topTabTextActive: {
    color: colors.text,
  },
  topTabTextInactive: {
    color: colors.textTertiary,
  },
  topTabIndicator: {
    position: 'absolute',
    bottom: -spacing.md,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.accent,
    borderRadius: 1,
  },
  topTabWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  // --- Search (bulk mode only) ---
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

  // --- Themes grid ---
  themesContainer: {
    padding: spacing.lg,
  },
  themesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  themeGridItem: {
    width: COLUMN_WIDTH,
  },

  // --- Content area ---
  content: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    flexGrow: 1,
  },
  instruction: {
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },

  // --- Grid (bulk mode) ---
  columnWrapper: {
    gap: GRID_GAP,
  },
  gridWithBar: {
    paddingBottom: 100,
  },
  gridItem: {
    width: COLUMN_WIDTH,
  },
  loadingMore: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
