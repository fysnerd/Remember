/**
 * Explorer Tab - Mes themes (grid) + Bibliotheque (inbox triage)
 */

import { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Pressable, RefreshControl, Dimensions, Alert } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Text, Badge, Skeleton } from '../../components/ui';
import { ContentCard, SourcePills, SelectionBar } from '../../components/content';
import { SearchInput } from '../../components/explorer/SearchInput';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { Search, BookOpen, Sparkles } from 'lucide-react-native';
import { ThemeGridCard } from '../../components/explorer/ThemeGridCard';
import { GlassLockOverlay } from '../../components/glass';
import { useInbox, useInboxCount, useTriageMutation, useDebouncedValue, useThemes, useDeleteTheme } from '../../hooks';
import { useSubscription } from '../../hooks/useSubscription';
import { useContentStore } from '../../stores/contentStore';
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
  } = useContentStore();

  // Subscription
  const { data: subscription } = useSubscription();
  const isFree = subscription?.plan !== 'PRO';

  // Debounce search for filtering
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Data fetching
  const { data: inboxCount } = useInboxCount();
  const { data: inboxItems, isLoading: inboxLoading } = useInbox();
  const triageMutation = useTriageMutation();
  const { data: themes, isLoading: themesLoading } = useThemes();
  const deleteThemeMutation = useDeleteTheme();

  const selectionMode = selectedIds.size > 0;

  // Filter inbox items by source + search (client-side filtering)
  const filteredInboxItems = useMemo(() => {
    let items = inboxItems;
    if (!items) return items;
    if (sourceFilter !== 'all') {
      items = items.filter((item) => item.source === sourceFilter);
    }
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      items = items.filter((item) =>
        item.title.toLowerCase().includes(searchLower) ||
        (item.channelName && item.channelName.toLowerCase().includes(searchLower))
      );
    }
    return items;
  }, [inboxItems, sourceFilter, debouncedSearch]);

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

  // Toggle selection on tap
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

  // Batch triage
  const handleBatchLearn = () => {
    if (selectedIds.size === 0) return;
    setBatchAction('learn');
    triageMutation.mutate(
      { contentIds: Array.from(selectedIds), action: 'learn' },
      {
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
                  onPress={() => handleThemePress(theme.id)}
                  onLongPress={() => handleThemeLongPress(theme.id, theme.name)}
                />
              </GlassLockOverlay>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    );
  };

  // --- Render: Bibliotheque tab content (inbox only) ---
  const renderLibraryTab = () => (
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

      {inboxLoading ? (
        <LoadingScreen />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.lg }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
          }
        >
          {filteredInboxItems?.length ? (
            <>
              {/* Instruction message */}
              <Text variant="caption" style={styles.instruction}>
                Selectionnez le contenu a garder
              </Text>
              <View style={[styles.grid, selectionMode && styles.gridWithBar]}>
                {filteredInboxItems.map((item) => (
                  <View key={item.id} style={styles.gridItem}>
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
                ))}
              </View>
            </>
          ) : sourceFilter !== 'all' && inboxItems?.length ? (
            <EmptyState message={`Aucun contenu ${sourceFilter === 'youtube' ? 'YouTube' : sourceFilter === 'spotify' ? 'Spotify' : sourceFilter === 'tiktok' ? 'TikTok' : 'Instagram'} a trier`} icon={Search} hasHeader />
          ) : debouncedSearch && inboxItems?.length ? (
            <EmptyState message="Aucun resultat pour cette recherche" icon={Search} hasHeader />
          ) : (
            <EmptyState message="Rien a trier pour le moment" icon={Sparkles} hasHeader />
          )}
        </ScrollView>
      )}
    </>
  );

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
      {/* Top-level tabs: Suggestions | Bibliotheque */}
      <View style={styles.topTabBar}>
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

      {/* Tab content */}
      {activeExplorerTab === 'suggestions' ? renderThemesTab() : renderLibraryTab()}

      {/* Selection bar - appears when items selected in triage */}
      {selectionMode && activeExplorerTab === 'library' && (
        <SelectionBar
          selectedCount={selectedIds.size}
          onLearn={handleBatchLearn}
          onIgnore={handleBatchIgnore}
          onCancel={handleCancelSelection}
          loadingLearn={batchAction === 'learn'}
          loadingIgnore={batchAction === 'ignore'}
        />
      )}
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
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

  // --- Search ---
  searchContainer: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
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

  // --- Grid ---
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridWithBar: {
    paddingBottom: 100,
  },
  gridItem: {
    width: COLUMN_WIDTH,
  },
});
