/**
 * Explorer Tab - Suggestions + Bibliotheque (two top-level tabs)
 * Suggestions: 8 thematic topics (all locked if FREE)
 * Bibliotheque: inbox content to triage with source filter, search, and batch actions
 */

import { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Pressable, RefreshControl, Dimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Text, Badge, Skeleton } from '../../components/ui';
import { ContentCard, SourcePills, SelectionBar } from '../../components/content';
import { SearchInput } from '../../components/explorer/SearchInput';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { Search, Sparkles } from 'lucide-react-native';
import { SuggestionCard } from '../../components/explorer/SuggestionCard';
import { GlassLockOverlay } from '../../components/glass';
import { useInbox, useInboxCount, useTriageMutation, useDebouncedValue, useThemeSuggestions } from '../../hooks';
import { useSubscription } from '../../hooks/useSubscription';
import { useContentStore } from '../../stores/contentStore';
import { colors, spacing } from '../../theme';

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
  const { data: suggestionsData, isLoading: suggestionsLoading, error: suggestionsError } = useThemeSuggestions();

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
    await queryClient.invalidateQueries({ queryKey: ['inbox'] });
    setRefreshing(false);
  }, [queryClient]);

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

  // --- Render: Suggestions tab content ---
  const renderSuggestionsTab = () => {
    if (suggestionsLoading) {
      return (
        <View style={styles.suggestionsContainer}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={72} width="100%" />
          ))}
        </View>
      );
    }

    if (suggestionsError || !suggestionsData?.suggestions?.length) {
      return (
        <EmptyState
          message="Des suggestions personnalisees arrivent bientot"
          icon={Sparkles}
          hasHeader
        />
      );
    }

    return (
      <ScrollView
        contentContainerStyle={[styles.suggestionsContainer, { paddingBottom: tabBarHeight + spacing.lg }]}
      >
        <Text variant="h3" style={{ marginBottom: spacing.md }}>
          Suggestions pour toi
        </Text>
        {suggestionsData.suggestions.map((suggestion, index) => (
          <GlassLockOverlay key={`${suggestion.name}-${index}`} locked={isFree}>
            <SuggestionCard
              title={`${suggestion.emoji} ${suggestion.name}`}
              description={suggestion.description}
            />
          </GlassLockOverlay>
        ))}
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
            Suggestions
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
      {activeExplorerTab === 'suggestions' ? renderSuggestionsTab() : renderLibraryTab()}

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

  // --- Suggestions ---
  suggestionsContainer: {
    padding: spacing.lg,
    gap: spacing.md,
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
