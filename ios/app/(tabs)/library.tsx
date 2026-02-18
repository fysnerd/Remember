/**
 * Library Tab - Browse all content + Triage mode via button
 *
 * Default: Browse mode showing all non-archived content (INBOX with "Nouveau" badge,
 * processing with pipeline badge, READY normal). Filterable by platform + theme.
 *
 * Long-press: Enters selection mode for multi-content quiz launch.
 * Triage: Activated via "Trier" button, uses SwipeCardStack for inbox items.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, FlatList, ScrollView, StyleSheet, RefreshControl, Dimensions, ActivityIndicator, Pressable, Modal } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text, Button } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { ContentCard, SourcePills, SwipeCardStack, TriageModeToggle } from '../../components/content';
import { ThemePills } from '../../components/reviews/ThemePills';
import { SearchInput } from '../../components/explorer/SearchInput';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { PlatformIcon } from '../../components/icons';
import { Search, PartyPopper, X, BookOpen, Play, SlidersHorizontal, Check } from 'lucide-react-native';
import { useLibraryContent, useInbox, useInboxCount, useSwipeTriage, useDebouncedValue, useThemes, useAvailableSources } from '../../hooks';
import { useContentStore } from '../../stores/contentStore';
import { haptics } from '../../lib/haptics';
import type { Content } from '../../types/content';
import { colors, spacing, borderRadius } from '../../theme';
import api from '../../lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = spacing.sm;
const GRID_PADDING = spacing.lg;
const COLUMN_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

export default function LibraryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const autoSwitchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [pendingSource, setPendingSource] = useState<'all' | 'youtube' | 'spotify' | 'tiktok' | 'instagram'>('all');

  const selectionMode = selectedIds.size > 0;

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
  const { data: availableSources } = useAvailableSources();
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

  // Count how many selected items are READY (have quizzes available)
  const selectedReadyCount = useMemo(() => {
    if (!libraryItems || selectedIds.size === 0) return 0;
    return libraryItems.filter(
      (item) => selectedIds.has(item.id) && item.status === 'READY' && (item.quizCount ?? 0) > 0
    ).length;
  }, [libraryItems, selectedIds]);

  // Reset source filter if current selection has no content
  useEffect(() => {
    if (availableSources && sourceFilter !== 'all' && !availableSources.includes(sourceFilter)) {
      setSourceFilter('all');
    }
  }, [availableSources, sourceFilter, setSourceFilter]);

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

  const handleSkip = useCallback((_item: Content) => {
    // Skip: just advance the card, no backend action
  }, []);

  const handleUndo = useCallback((item: Content) => {
    // Reset content back to INBOX on the backend
    api.patch(`/content/${item.id}/triage`, { action: 'undo' }).catch(() => {});
    showToast('Annule', 'success');
  }, [showToast]);

  const handleSwipeEmpty = useCallback(() => {}, []);

  const handleNearEnd = useCallback(() => {
    if (inboxHasNextPage && !inboxFetchingNextPage) {
      inboxFetchNextPage();
    }
  }, [inboxHasNextPage, inboxFetchingNextPage, inboxFetchNextPage]);

  // --- Selection handlers ---
  const handleToggleSelection = useCallback((id: string) => {
    haptics.selection();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleLongPress = useCallback((id: string) => {
    haptics.medium();
    setSelectedIds(new Set([id]));
  }, []);

  const handleCancelSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleLaunchQuiz = useCallback(() => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setSelectedIds(new Set());
    if (ids.length === 1) {
      router.push({ pathname: '/quiz/[id]' as any, params: { id: ids[0] } });
    } else {
      router.push({ pathname: '/quiz/preview/multi' as any, params: { ids: ids.join(',') } });
    }
  }, [selectedIds, router]);

  // --- Browse mode handlers ---
  const handleContentPress = useCallback((id: string) => {
    if (selectionMode) {
      handleToggleSelection(id);
    } else {
      router.push(`/content/${id}`);
    }
  }, [selectionMode, handleToggleSelection, router]);

  const handleContentLongPress = useCallback((id: string) => {
    if (!selectionMode) {
      handleLongPress(id);
    }
  }, [selectionMode, handleLongPress]);

  const handleLibraryLoadMore = useCallback(() => {
    if (libraryHasNextPage && !libraryFetchingNextPage) {
      libraryFetchNextPage();
    }
  }, [libraryHasNextPage, libraryFetchingNextPage, libraryFetchNextPage]);

  // --- Mode switching ---
  const handleOpenTriage = useCallback(() => {
    setSelectedIds(new Set());
    // Refetch inbox to get fresh data (items may have been triaged since last fetch)
    queryClient.invalidateQueries({ queryKey: ['inbox'] });
    setViewMode('triage');
  }, [setViewMode, queryClient]);

  const handleCloseTriage = useCallback(() => {
    setViewMode('browse');
    // Invalidate both library (new items appeared) and inbox (items removed)
    queryClient.invalidateQueries({ queryKey: ['content', 'library'] });
    queryClient.invalidateQueries({ queryKey: ['inbox'] });
  }, [setViewMode, queryClient]);

  // --- Filter drawer ---
  const handleOpenFilterDrawer = useCallback(() => {
    setPendingSource(sourceFilter);
    setShowFilterDrawer(true);
  }, [sourceFilter]);

  const handleApplyFilter = useCallback(() => {
    setSourceFilter(pendingSource);
    setShowFilterDrawer(false);
    haptics.selection();
  }, [pendingSource, setSourceFilter]);

  const isFilterActive = sourceFilter !== 'all';

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
        isSelected={selectedIds.has(item.id)}
        selectionMode={selectionMode}
        onPress={() => handleContentPress(item.id)}
        onLongPress={() => handleContentLongPress(item.id)}
      />
    </View>
  ), [handleContentPress, handleContentLongPress, selectedIds, selectionMode]);

  // =====================================================
  // BROWSE MODE
  // =====================================================
  const renderBrowseMode = () => (
    <>
      {/* Search bar + filter icon */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.filterButton,
            isFilterActive && styles.filterButtonActive,
            pressed && { opacity: 0.7 },
          ]}
          onPress={handleOpenFilterDrawer}
          hitSlop={4}
        >
          <SlidersHorizontal
            size={18}
            color={isFilterActive ? colors.background : colors.textSecondary}
            strokeWidth={1.75}
          />
        </Pressable>
      </View>

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
          contentContainerStyle={[
            styles.content,
            { paddingBottom: tabBarHeight + spacing.lg + (selectionMode ? 80 : 0) },
          ]}
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
  const renderTriageMode = () => (
    <>
      <SourcePills
        selectedSource={sourceFilter}
        onSourceChange={setSourceFilter}
        availableSources={availableSources}
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
            onSkip={handleSkip}
            onUndo={handleUndo}
            onEmpty={handleSwipeEmpty}
            onNearEnd={handleNearEnd}
          />
        </ScrollView>
      )}
    </>
  );

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
      {/* Header */}
      <View style={styles.topTabBar}>
        {viewMode === 'browse' ? (
          selectionMode ? (
            <>
              <View style={styles.selectionHeader}>
                <Pressable onPress={handleCancelSelection} hitSlop={8}>
                  <X size={20} color={colors.text} strokeWidth={2} />
                </Pressable>
                <Text variant="body" weight="medium" style={styles.topTabTextActive}>
                  {selectedIds.size} selectionne{selectedIds.size > 1 ? 's' : ''}
                </Text>
              </View>
              <View />
            </>
          ) : (
            <>
              <View />
              <TriageModeToggle inboxCount={inboxCount ?? 0} onPress={handleOpenTriage} />
            </>
          )
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

      {/* Selection action bar */}
      {selectionMode && viewMode === 'browse' && (
        <View style={[styles.selectionBar, { paddingBottom: tabBarHeight + spacing.sm }]}>
          <Button
            variant="primary"
            onPress={handleLaunchQuiz}
            disabled={selectedReadyCount === 0}
            fullWidth
          >
            <View style={styles.quizButtonContent}>
              <Play size={16} color={colors.background} fill={colors.background} />
              <Text weight="medium" style={styles.quizButtonText}>
                {selectedReadyCount > 0
                  ? `Lancer le quiz (${selectedReadyCount})`
                  : 'Aucun quiz disponible'}
              </Text>
            </View>
          </Button>
        </View>
      )}

      {/* Source filter drawer */}
      <Modal
        visible={showFilterDrawer}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterDrawer(false)}
      >
        <Pressable style={styles.drawerOverlay} onPress={() => setShowFilterDrawer(false)}>
          <Pressable style={[styles.drawerSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            {/* Handle bar */}
            <View style={styles.drawerHandle} />

            <Text variant="h3" weight="semibold" style={styles.drawerTitle}>
              Sources
            </Text>

            {/* Source options */}
            {[
              { key: 'all' as const, label: 'Toutes les sources' },
              { key: 'youtube' as const, label: 'YouTube' },
              { key: 'spotify' as const, label: 'Spotify' },
              { key: 'tiktok' as const, label: 'TikTok' },
              { key: 'instagram' as const, label: 'Instagram' },
            ]
              .filter((s) => s.key === 'all' || !availableSources || availableSources.includes(s.key))
              .map((source) => {
                const isSelected = pendingSource === source.key;
                return (
                  <Pressable
                    key={source.key}
                    style={({ pressed }) => [
                      styles.drawerOption,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => {
                      setPendingSource(source.key);
                      haptics.selection();
                    }}
                  >
                    <View style={styles.drawerOptionLeft}>
                      {source.key !== 'all' && (
                        <PlatformIcon platform={source.key} size={18} colored />
                      )}
                      <Text
                        variant="body"
                        weight={isSelected ? 'medium' : 'regular'}
                        style={{ color: colors.text }}
                      >
                        {source.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <Check size={18} color={colors.accent} strokeWidth={2.5} />
                    )}
                  </Pressable>
                );
              })}

            {/* Apply button */}
            <Pressable
              style={({ pressed }) => [
                styles.drawerApplyButton,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleApplyFilter}
            >
              <Text variant="body" weight="medium" style={{ color: colors.background }}>
                Appliquer
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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

  // --- Search + filter ---
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchContainer: {
    flex: 1,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
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

  // --- Selection bar ---
  selectionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  quizButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  quizButtonText: {
    color: colors.background,
    fontSize: 15,
  },

  // --- Filter drawer ---
  drawerOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  drawerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  drawerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  drawerTitle: {
    color: colors.text,
    marginBottom: spacing.md,
  },
  drawerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  drawerOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  drawerApplyButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
});
