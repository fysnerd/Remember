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
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text, Button } from '../../../components/ui';
import { useToast } from '../../../components/ui/Toast';
import { ContentCard, SourcePills, SwipeCardStack, TriageModeToggle, type SwipeCardStackRef } from '../../../components/content';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { EmptyState } from '../../../components/EmptyState';
import { PlatformIcon } from '../../../components/icons';
import { Search, PartyPopper, X, BookOpen, Play, Check, ChevronDown, Undo2 } from 'lucide-react-native';
import { useLibraryContent, useInbox, useInboxCount, useSwipeTriage, useDebouncedValue, useThemes, useAvailableSources } from '../../../hooks';
import { useContentStore, type SourceKey } from '../../../stores/contentStore';
import { haptics } from '../../../lib/haptics';
import type { Content } from '../../../types/content';
import { colors, spacing, borderRadius, fonts } from '../../../theme';
import api from '../../../lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = spacing.md;
const GRID_PADDING = spacing.lg;
const COLUMN_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

export default function LibraryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { bottom: bottomInset, top: topInset } = useSafeAreaInsets();
  const tabBarHeight = bottomInset + 49;
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [pendingSources, setPendingSources] = useState<SourceKey[]>([]);
  const swipeStackRef = useRef<SwipeCardStackRef>(null);
  const [canUndo, setCanUndo] = useState(false);

  const selectionMode = selectedIds.size > 0;

  // Store state
  const {
    searchQuery,
    setSearchQuery,
    sourceFilters,
    setSourceFilters,
    themeFilters,
    toggleThemeFilter,
    clearThemeFilters,
    viewMode,
    setViewMode,
    showFilterDrawer,
    setShowFilterDrawer,
  } = useContentStore();

  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Sync pendingSources when filter drawer opens (triggered from header button)
  useEffect(() => {
    if (showFilterDrawer) {
      setPendingSources([...sourceFilters]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFilterDrawer]);

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
    sources: sourceFilters.length > 0 ? sourceFilters : undefined,
    themeId: themeFilters.length > 0 ? themeFilters.join(',') : undefined,
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
  } = useInbox(sourceFilters.length > 0 ? sourceFilters : undefined);

  const swipeTriage = useSwipeTriage();
  const { ToastComponent } = useToast();

  // Theme pills data
  const themeOptions = useMemo(() => {
    if (!themes) return [];
    return themes.map((t) => ({
      id: t.id,
      name: t.name,
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

  // Reset source filters if selected sources no longer have content
  useEffect(() => {
    if (availableSources && sourceFilters.length > 0) {
      const valid = sourceFilters.filter((s) => availableSources.includes(s));
      if (valid.length !== sourceFilters.length) {
        setSourceFilters(valid);
      }
    }
  }, [availableSources, sourceFilters, setSourceFilters]);


  // Pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    api.post('/content/refresh').catch(() => { });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['content'] }),
      queryClient.invalidateQueries({ queryKey: ['inbox'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  // --- Swipe handlers ---
  const handleSwipeRight = useCallback((item: Content) => {
    swipeTriage.mutate({ contentId: item.id, action: 'learn' });
  }, [swipeTriage]);

  const handleSwipeLeft = useCallback((item: Content) => {
    swipeTriage.mutate({ contentId: item.id, action: 'archive' });
  }, [swipeTriage]);

  const handleSkip = useCallback((_item: Content) => { }, []);

  const handleUndo = useCallback((item: Content) => {
    api.patch(`/content/${item.id}/triage`, { action: 'undo' }).catch(() => { });
  }, []);

  const handleSwipeEmpty = useCallback(() => { }, []);

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
    queryClient.invalidateQueries({ queryKey: ['inbox'] });
    setViewMode('triage');
  }, [setViewMode, queryClient]);

  const handleCloseTriage = useCallback(() => {
    setViewMode('browse');
    queryClient.invalidateQueries({ queryKey: ['content', 'library'] });
    queryClient.invalidateQueries({ queryKey: ['inbox'] });
  }, [setViewMode, queryClient]);

  // --- Filter drawer ---
  const handleTogglePendingSource = useCallback((source: SourceKey) => {
    haptics.selection();
    setPendingSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  }, []);

  const handleApplyFilter = useCallback(() => {
    setSourceFilters(pendingSources);
    setShowFilterDrawer(false);
    haptics.selection();
  }, [pendingSources, setSourceFilters, setShowFilterDrawer]);

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

  // --- List header (filters + selection) ---
  const renderBrowseListHeader = useCallback(() => (
    <>
      <View style={styles.filterRowWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <Pressable
          style={[styles.sourcesDropdown, sourceFilters.length > 0 && styles.sourcesDropdownActive]}
          onPress={() => setShowFilterDrawer(true)}
        >
          <Text
            variant="caption"
            weight={sourceFilters.length > 0 ? 'medium' : 'regular'}
            style={[styles.sourcesLabel, sourceFilters.length > 0 && styles.sourcesLabelActive]}
          >
            Sources{sourceFilters.length > 0 ? ` (${sourceFilters.length})` : ''}
          </Text>
          <ChevronDown size={14} color={sourceFilters.length > 0 ? colors.background : colors.text} strokeWidth={2} />
        </Pressable>

        {themeOptions.length > 0 && <View style={styles.filterDivider} />}

        {themeOptions.length > 0 && (
          <Pressable
            style={[styles.themePill, themeFilters.length === 0 && styles.themePillActive]}
            onPress={clearThemeFilters}
          >
            <Text
              variant="caption"
              weight={themeFilters.length === 0 ? 'medium' : 'regular'}
              style={[styles.themePillLabel, themeFilters.length === 0 && styles.themePillLabelActive]}
            >
              Tout
            </Text>
          </Pressable>
        )}
        {themeOptions.map((theme) => {
          const isActive = themeFilters.includes(theme.id);
          return (
            <Pressable
              key={theme.id}
              style={[styles.themePill, isActive && styles.themePillActive]}
              onPress={() => toggleThemeFilter(theme.id)}
            >
              <Text
                variant="caption"
                weight={isActive ? 'medium' : 'regular'}
                style={[styles.themePillLabel, isActive && styles.themePillLabelActive]}
                numberOfLines={1}
              >
                {theme.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      </View>

      {selectionMode && (
        <View style={styles.selectionHeader}>
          <Pressable onPress={handleCancelSelection} hitSlop={8}>
            <X size={20} color={colors.text} strokeWidth={2} />
          </Pressable>
          <Text variant="body" weight="medium" style={{ color: colors.text }}>
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </>
  ), [sourceFilters, themeFilters, themeOptions, selectionMode, selectedIds.size, handleCancelSelection, setShowFilterDrawer, clearThemeFilters, toggleThemeFilter]);

  // =====================================================
  // BROWSE MODE
  // =====================================================
  const renderBrowseMode = () => (
    <>
      {libraryLoading ? (
        <LoadingScreen />
      ) : !libraryItems?.length ? (
        <ScrollView
          contentContainerStyle={[styles.emptyContainer, { paddingBottom: tabBarHeight + spacing.lg }]}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
          }
        >
          {debouncedSearch ? (
            <EmptyState message="Aucun résultat" icon={Search} />
          ) : (
            <EmptyState message="Aucun contenu pour le moment" icon={BookOpen} />
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
          contentInsetAdjustmentBehavior="automatic"
          ListHeaderComponent={renderBrowseListHeader}
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
  const triageSourceFilter = sourceFilters.length === 1 ? sourceFilters[0] : 'all';
  const handleTriageSourceChange = useCallback((source: 'all' | 'youtube' | 'spotify' | 'tiktok' | 'instagram') => {
    setSourceFilters(source === 'all' ? [] : [source as SourceKey]);
  }, [setSourceFilters]);

  const renderTriageMode = () => (
    <>
      {/* Header — undo button left, close button right */}
      <View style={[styles.triageHeader, { paddingTop: topInset + spacing.sm }]}>
        <Pressable
          style={({ pressed }) => [
            styles.closeButton,
            !canUndo && { opacity: 0.3 },
            pressed && canUndo && styles.closeButtonPressed,
          ]}
          onPress={() => swipeStackRef.current?.triggerUndo()}
          hitSlop={8}
          disabled={!canUndo}
        >
          <Undo2 size={18} color={colors.textSecondary} strokeWidth={2.5} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
          onPress={handleCloseTriage}
          hitSlop={8}
        >
          <X size={22} color={colors.textSecondary} strokeWidth={2.5} />
        </Pressable>
      </View>

      {inboxLoading ? (
        <LoadingScreen />
      ) : !filteredInboxItems.length ? (
        <View style={styles.triageDoneContainer}>
          <Animated.View entering={FadeInDown.duration(400)} style={styles.triageDoneContent}>
            <Text style={styles.triageDoneEmoji}>
              {sourceFilters.length > 0 ? '🔍' : '🎉'}
            </Text>
            <Text style={styles.triageDoneTitle}>
              {sourceFilters.length > 0 ? 'Rien à trier' : 'Tout est trié !'}
            </Text>
            <Text style={styles.triageDoneSubtitle}>
              {sourceFilters.length > 0
                ? 'Aucun nouveau contenu pour ces sources'
                : 'Tous tes contenus ont été triés. Reviens plus tard !'}
            </Text>
            <View style={styles.triageDoneActions}>
              <Button variant="primary" size="lg" fullWidth onPress={handleCloseTriage}>
                Retour
              </Button>
            </View>
          </Animated.View>
        </View>
      ) : (
        <SwipeCardStack
          ref={swipeStackRef}
          key={sourceFilters.join(',')}
          items={filteredInboxItems}
          onSwipeRight={handleSwipeRight}
          onSwipeLeft={handleSwipeLeft}
          onSkip={handleSkip}
          onUndo={handleUndo}
          onEmpty={handleSwipeEmpty}
          onNearEnd={handleNearEnd}
          onCanUndoChange={setCanUndo}
        />
      )}
    </>
  );

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={styles.container}
    >
      {/* Browse mode */}
      {viewMode === 'browse' && renderBrowseMode()}

      {/* Triage mode — fullscreen modal, hides tab bar */}
      <Modal
        visible={viewMode === 'triage'}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseTriage}
      >
        <SafeAreaView style={styles.triageModal} edges={['bottom']}>
          {renderTriageMode()}
          <ToastComponent />
        </SafeAreaView>
      </Modal>

      {/* Floating triage button */}
      {viewMode === 'browse' && !selectionMode && (inboxCount ?? 0) > 0 && (
        <View style={[styles.floatingTriageButton, { bottom: tabBarHeight - spacing.lg }]}>
          <TriageModeToggle inboxCount={inboxCount ?? 0} onPress={handleOpenTriage} />
        </View>
      )}

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
          <Pressable style={[styles.drawerSheet, { paddingBottom: bottomInset + spacing.lg }]}>
            {/* Handle bar */}
            <View style={styles.drawerHandle} />

            <Text variant="h3" weight="semibold" style={styles.drawerTitle}>
              Sources
            </Text>

            {/* Source checkboxes */}
            {([
              { key: 'youtube' as SourceKey, label: 'YouTube' },
              { key: 'spotify' as SourceKey, label: 'Spotify' },
              { key: 'tiktok' as SourceKey, label: 'TikTok' },
              { key: 'instagram' as SourceKey, label: 'Instagram' },
            ] as const)
              .filter((s) => !availableSources || availableSources.includes(s.key))
              .map((source) => {
                const isChecked = pendingSources.includes(source.key);
                return (
                  <Pressable
                    key={source.key}
                    style={({ pressed }) => [
                      styles.drawerOption,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => handleTogglePendingSource(source.key)}
                  >
                    <View style={styles.drawerOptionLeft}>
                      <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                        {isChecked && <Check size={14} color={colors.background} strokeWidth={3} />}
                      </View>
                      <PlatformIcon platform={source.key} size={18} colored />
                      <Text
                        variant="body"
                        weight={isChecked ? 'medium' : 'regular'}
                        style={{ color: colors.text }}
                      >
                        {source.label}
                      </Text>
                    </View>
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

  // --- Filter row ---
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.lg,
    gap: spacing.sm,
  },
  filterRowWrapper: {
    marginHorizontal: -spacing.lg,
    marginBottom: spacing.md,
  },
  sourcesDropdown: {
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
  sourcesDropdownActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  sourcesLabel: {
    color: colors.text,
    fontSize: 13,
  },
  sourcesLabelActive: {
    color: colors.background,
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.borderLight,
  },
  themePill: {
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

  // --- Selection header (in list header) ---
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },

  // --- Floating triage button ---
  floatingTriageButton: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 10,
  },

  // --- Triage fullscreen modal ---
  triageModal: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  triageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  undoBtnHidden: {
    opacity: 0,
  },

  // --- Swipe mode ---
  swipeScrollWrapper: {
    flex: 1,
  },
  // --- Triage done screen ---
  triageDoneContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  triageDoneContent: {
    alignItems: 'center',
    width: '100%',
  },
  triageDoneEmoji: {
    fontSize: 72,
    lineHeight: 84,
    marginBottom: spacing.lg,
  },
  triageDoneTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 38,
    marginBottom: spacing.sm,
  },
  triageDoneSubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  triageDoneActions: {
    width: '100%',
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
    marginBottom: GRID_GAP,
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
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.xs,
    borderWidth: 2,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  drawerApplyButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
});
