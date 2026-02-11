/**
 * Library Tab - Collection + Triage (2-column grid with thumbnails)
 * Supports multi-select via long press for batch triage
 */

import { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Pressable, RefreshControl, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Text, Badge } from '../../components/ui';
import { ContentCard, FilterBar, SourcePills, SelectionBar } from '../../components/content';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { BookOpen, Search, Sparkles } from 'lucide-react-native';
import { useContentList, useInbox, useInboxCount, useTriageMutation, useTopics, useChannels } from '../../hooks';
import { useContentStore } from '../../stores/contentStore';
import { colors, spacing, borderRadius, shadows } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = spacing.sm;
const GRID_PADDING = spacing.lg;
const COLUMN_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

export default function LibraryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<'learn' | 'ignore' | null>(null);

  // Store state
  const {
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

  // Build filters for API
  const filters = useMemo(() => {
    const f: { source?: string; topic?: string; channel?: string } = {};
    if (sourceFilter !== 'all') f.source = sourceFilter;
    if (topicFilter) f.topic = topicFilter;
    if (channelFilter) f.channel = channelFilter;
    return f;
  }, [sourceFilter, topicFilter, channelFilter]);

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

  const isLoading = activeLibraryTab === 'collection' ? collectionLoading : inboxLoading;

  return (
    <View style={styles.container}>
      {/* Tab Toggle - Clean underline style */}
      <View style={styles.tabBar}>
        <Pressable
          style={styles.tab}
          onPress={() => setActiveLibraryTab('collection')}
        >
          <Text
            variant="body"
            weight={activeLibraryTab === 'collection' ? 'medium' : 'regular'}
            style={activeLibraryTab === 'collection' ? styles.tabTextActive : styles.tabTextInactive}
          >
            Ma collection
          </Text>
          {activeLibraryTab === 'collection' && <View style={styles.tabIndicator} />}
        </Pressable>
        <Pressable
          style={styles.tab}
          onPress={() => setActiveLibraryTab('triage')}
        >
          <View style={styles.tabWithBadge}>
            <Text
              variant="body"
              weight={activeLibraryTab === 'triage' ? 'medium' : 'regular'}
              style={activeLibraryTab === 'triage' ? styles.tabTextActive : styles.tabTextInactive}
            >
              À trier
            </Text>
            {(inboxCount ?? 0) > 0 && <Badge count={inboxCount ?? 0} size="sm" />}
          </View>
          {activeLibraryTab === 'triage' && <View style={styles.tabIndicator} />}
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

      {isLoading ? (
        <LoadingScreen />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
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
                Sélectionnez le contenu à garder
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
            <EmptyState message={`Aucun contenu ${inboxSourceFilter === 'youtube' ? 'YouTube' : inboxSourceFilter === 'spotify' ? 'Spotify' : inboxSourceFilter === 'tiktok' ? 'TikTok' : 'Instagram'} à trier`} icon={Search} hasHeader />
          ) : (
            <EmptyState message="Rien à trier pour le moment" icon={Sparkles} hasHeader />
          )}
        </ScrollView>
      )}

      {/* Selection bar - appears when items selected */}
      {selectionMode && (
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
  // Tab bar - underline style
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  tab: {
    paddingVertical: spacing.sm,
    position: 'relative',
  },
  tabTextActive: {
    color: colors.text,
  },
  tabTextInactive: {
    color: colors.textTertiary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -spacing.md,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.text,
    borderRadius: 1,
  },
  tabWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  // Content area
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
  // Grid
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
