/**
 * Explorer Tab - Suggestions + Library (two-level tab architecture)
 * Top-level: Suggestions | Bibliotheque
 * Library sub-tabs: Ma collection | A trier
 * Supports search, filters, and batch triage
 */

import { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Pressable, RefreshControl, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Text, Badge } from '../../components/ui';
import { ContentCard, FilterBar, SourcePills, SelectionBar } from '../../components/content';
import { SearchInput } from '../../components/explorer/SearchInput';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { BookOpen, Search, Sparkles } from 'lucide-react-native';
import { useContentList, useInbox, useInboxCount, useTriageMutation, useTopics, useChannels, useDebouncedValue } from '../../hooks';
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
    activeLibraryTab,
    setActiveLibraryTab,
    sourceFilter,
    topicFilter,
    channelFilter,
    setSourceFilter,
    setTopicFilter,
    setChannelFilter,
    inboxSourceFilter,
    setInboxSourceFilter,
  } = useContentStore();

  // Debounce search for API calls
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Build filters for API (include search)
  const filters = useMemo(() => {
    const f: { source?: string; topic?: string; channel?: string; search?: string } = {};
    if (sourceFilter !== 'all') f.source = sourceFilter;
    if (topicFilter) f.topic = topicFilter;
    if (channelFilter) f.channel = channelFilter;
    if (debouncedSearch) f.search = debouncedSearch;
    return f;
  }, [sourceFilter, topicFilter, channelFilter, debouncedSearch]);

  // Data fetching
  const { data: inboxCount } = useInboxCount();
  const { data: collectionData, isLoading: collectionLoading } = useContentList(filters);
  const { data: inboxItems, isLoading: inboxLoading } = useInbox();
  const { data: topics = [] } = useTopics();
  const { data: channels = [] } = useChannels();
  const triageMutation = useTriageMutation();

  const selectionMode = selectedIds.size > 0;

  // Filter inbox items by source (client-side filtering)
  const filteredInboxItems = useMemo(() => {
    if (!inboxItems || inboxSourceFilter === 'all') return inboxItems;
    return inboxItems.filter((item) => item.source === inboxSourceFilter);
  }, [inboxItems, inboxSourceFilter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['content'] });
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

  const handleContentPress = (id: string) => {
    router.push(`/content/${id}`);
  };

  const handleInboxItemPress = (id: string) => {
    // In triage tab, tap always toggles selection
    handleToggleSelection(id);
  };

  const isLibraryLoading = activeLibraryTab === 'collection' ? collectionLoading : inboxLoading;

  // --- Render: Suggestions tab content ---
  const renderSuggestionsTab = () => (
    <EmptyState
      message="Des suggestions personnalisees arrivent bientot"
      icon={Sparkles}
      hasHeader
    />
  );

  // --- Render: Library tab content ---
  const renderLibraryTab = () => (
    <>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Library sub-tabs: Collection / Triage */}
      <View style={styles.subTabBar}>
        <Pressable
          style={styles.subTab}
          onPress={() => setActiveLibraryTab('collection')}
        >
          <Text
            variant="caption"
            weight={activeLibraryTab === 'collection' ? 'medium' : 'regular'}
            style={activeLibraryTab === 'collection' ? styles.subTabTextActive : styles.subTabTextInactive}
          >
            Ma collection
          </Text>
          {activeLibraryTab === 'collection' && <View style={styles.subTabIndicator} />}
        </Pressable>
        <Pressable
          style={styles.subTab}
          onPress={() => setActiveLibraryTab('triage')}
        >
          <View style={styles.subTabWithBadge}>
            <Text
              variant="caption"
              weight={activeLibraryTab === 'triage' ? 'medium' : 'regular'}
              style={activeLibraryTab === 'triage' ? styles.subTabTextActive : styles.subTabTextInactive}
            >
              A trier
            </Text>
            {(inboxCount ?? 0) > 0 && <Badge count={inboxCount ?? 0} size="sm" />}
          </View>
          {activeLibraryTab === 'triage' && <View style={styles.subTabIndicator} />}
        </Pressable>
      </View>

      {/* Filters - collection tab has full FilterBar, triage tab has SourcePills */}
      {activeLibraryTab === 'collection' ? (
        <FilterBar
          selectedSource={sourceFilter}
          selectedTopic={topicFilter}
          selectedChannel={channelFilter}
          topics={topics}
          channels={channels}
          onSourceChange={setSourceFilter}
          onTopicChange={setTopicFilter}
          onChannelChange={setChannelFilter}
        />
      ) : (
        <SourcePills
          selectedSource={inboxSourceFilter}
          onSourceChange={setInboxSourceFilter}
        />
      )}

      {isLibraryLoading ? (
        <LoadingScreen />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.lg }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
          }
        >
          {activeLibraryTab === 'collection' ? (
            collectionData?.items?.length ? (
              <View style={styles.grid}>
                {collectionData.items.map((item) => (
                  <View key={item.id} style={styles.gridItem}>
                    <ContentCard
                      id={item.id}
                      title={item.title}
                      source={item.source}
                      thumbnailUrl={item.thumbnailUrl}
                      channelName={item.channelName}
                      duration={item.duration}
                      onPress={() => handleContentPress(item.id)}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState message="Aucun contenu dans votre collection" icon={BookOpen} hasHeader />
            )
          ) : filteredInboxItems?.length ? (
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
          ) : inboxSourceFilter !== 'all' && inboxItems?.length ? (
            <EmptyState message={`Aucun contenu ${inboxSourceFilter === 'youtube' ? 'YouTube' : inboxSourceFilter === 'spotify' ? 'Spotify' : inboxSourceFilter === 'tiktok' ? 'TikTok' : 'Instagram'} a trier`} icon={Search} hasHeader />
          ) : (
            <EmptyState message="Rien a trier pour le moment" icon={Sparkles} hasHeader />
          )}
        </ScrollView>
      )}
    </>
  );

  return (
    <View style={styles.container}>
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
          <Text
            variant="body"
            weight={activeExplorerTab === 'library' ? 'medium' : 'regular'}
            style={activeExplorerTab === 'library' ? styles.topTabTextActive : styles.topTabTextInactive}
          >
            Bibliotheque
          </Text>
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
    </View>
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

  // --- Search ---
  searchContainer: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
  },

  // --- Library sub-tabs (Collection | Triage) ---
  subTabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  subTab: {
    paddingVertical: spacing.xs,
    position: 'relative',
  },
  subTabTextActive: {
    color: colors.text,
  },
  subTabTextInactive: {
    color: colors.textTertiary,
  },
  subTabIndicator: {
    position: 'absolute',
    bottom: -spacing.xs,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.accent,
    borderRadius: 1,
  },
  subTabWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
