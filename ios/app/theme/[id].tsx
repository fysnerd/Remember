/**
 * Theme Detail Screen - Grid layout with multi-select and swipe-to-delete
 */

import { useState, useCallback, useRef } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Dimensions, Pressable, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Inbox, Trash2, Brain, X } from 'lucide-react-native';
import { Text, Button } from '../../components/ui';
import { SwipeableContentCard } from '../../components/content';
import { ContentCard } from '../../components/content';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { useThemeDetail, useRemoveContentFromTheme, usePipelineStatus } from '../../hooks';
import { haptics } from '../../lib/haptics';
import api from '../../lib/api';
import { colors, spacing, borderRadius } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = spacing.sm;
const GRID_PADDING = spacing.lg;
const COLUMN_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

export default function ThemeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const { data, isLoading } = useThemeDetail(id);
  const removeContent = useRemoveContentFromTheme();
  const { processingMap } = usePipelineStatus();

  const selectionMode = selectedIds.size > 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['themes', id] });
    setRefreshing(false);
  }, [queryClient, id]);

  const handleContentPress = (contentId: string) => {
    if (selectionMode) {
      toggleSelection(contentId);
    } else {
      router.push({ pathname: '/content/[id]', params: { id: contentId } });
    }
  };

  const handleLongPress = (contentId: string) => {
    if (!selectionMode) {
      setSelectedIds(new Set([contentId]));
    }
  };

  const toggleSelection = (contentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(contentId)) {
        next.delete(contentId);
      } else {
        next.add(contentId);
      }
      return next;
    });
  };

  const handleCancelSelection = () => {
    setSelectedIds(new Set());
  };

  const handleRemoveContent = (contentId: string) => {
    if (!id) return;
    setRemovingIds((prev) => new Set(prev).add(contentId));
    removeContent.mutate(
      { themeId: id, contentId },
      { onSettled: () => setRemovingIds((prev) => { const next = new Set(prev); next.delete(contentId); return next; }) }
    );
  };

  const batchRemovingRef = useRef(false);
  const handleBatchRemove = useCallback(async () => {
    if (!id || selectedIds.size === 0 || batchRemovingRef.current) return;
    batchRemovingRef.current = true;
    haptics.warning();
    const ids = Array.from(selectedIds);
    setRemovingIds(new Set(ids));
    try {
      // Call API directly in parallel to avoid React Query mutation state issues
      await Promise.allSettled(
        ids.map((contentId) => api.delete(`/themes/${id}/content/${contentId}`))
      );
      // Invalidate queries once after all deletions
      await queryClient.invalidateQueries({ queryKey: ['themes', id] });
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      queryClient.invalidateQueries({ queryKey: ['content'] });
    } finally {
      setRemovingIds(new Set());
      setSelectedIds(new Set());
      batchRemovingRef.current = false;
    }
  }, [id, selectedIds, queryClient]);

  const handleStartQuiz = () => {
    if (id) {
      router.push({
        pathname: '/quiz/theme/[id]' as any,
        params: { id },
      });
    }
  };

  const handleStartSelectionQuiz = () => {
    if (selectedIds.size === 0) return;
    const contentIdsParam = Array.from(selectedIds).join(',');
    router.push({
      pathname: '/quiz/theme/[id]' as any,
      params: { id, contentIds: contentIdsParam },
    });
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  const theme = data?.theme;
  const contents = data?.contents ?? [];
  const canQuiz = theme?.canQuiz ?? false;
  const quizReadyCount = theme?.quizReadyCount ?? 0;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: theme?.name ?? '',
          headerBackTitle: 'Home',
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, selectionMode && { paddingBottom: 100 + insets.bottom }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
        }
      >
        {/* Illustration placeholder */}
        <View style={styles.illustration}>
          <Text style={styles.illustrationEmoji}>{theme?.emoji}</Text>
        </View>

        {/* Theme Header */}
        <View style={styles.header}>
          <Text variant="h2" style={styles.headerName}>
            {theme?.name}
          </Text>
          <Text variant="caption" color="secondary">
            {theme?.contentCount ?? 0} contenu{(theme?.contentCount ?? 0) !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Description */}
        {theme?.description ? (
          <Text variant="body" color="secondary" style={styles.description}>
            {theme.description}
          </Text>
        ) : null}

        {/* Action button - Quiz */}
        <View style={styles.actionButtons}>
          <Button
            variant="primary"
            onPress={handleStartQuiz}
            disabled={!canQuiz}
            style={styles.actionBtn}
          >
            {canQuiz ? 'Quiz' : `Quiz (${quizReadyCount}/3)`}
          </Button>
        </View>
        {!canQuiz && (
          <Text variant="caption" color="secondary" style={styles.quizHint}>
            Il faut au moins 3 contenus avec quiz pour lancer un quiz theme.
          </Text>
        )}

        {/* Content Grid */}
        {contents.length === 0 ? (
          <EmptyState message="Aucun contenu dans ce theme" icon={Inbox} />
        ) : (
          <View style={styles.grid}>
            {contents.map((item) => (
              <View key={item.id} style={styles.gridItem}>
                {selectionMode ? (
                  <ContentCard
                    id={item.id}
                    title={item.title}
                    source={item.source}
                    thumbnailUrl={item.thumbnailUrl}
                    channelName={item.channelName}
                    duration={item.duration}
                    onPress={() => handleContentPress(item.id)}
                    onLongPress={() => handleLongPress(item.id)}
                    isSelected={selectedIds.has(item.id)}
                    selectionMode={true}
                    status={processingMap.get(item.id) ?? item.status}
                  />
                ) : (
                  <SwipeableContentCard
                    id={item.id}
                    title={item.title}
                    source={item.source}
                    thumbnailUrl={item.thumbnailUrl}
                    channelName={item.channelName}
                    duration={item.duration}
                    onPress={() => handleContentPress(item.id)}
                    onLongPress={() => handleLongPress(item.id)}
                    onDelete={() => handleRemoveContent(item.id)}
                    status={processingMap.get(item.id) ?? item.status}
                  />
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Selection bar */}
      {selectionMode && (
        <View style={[styles.selectionBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <View style={styles.selectionContent}>
            <Pressable
              style={({ pressed }) => [styles.selectionCancelBtn, pressed && styles.pressed]}
              onPress={handleCancelSelection}
            >
              <X size={18} color={colors.textSecondary} />
            </Pressable>

            <Text variant="body" weight="medium" style={styles.selectionCount}>
              {selectedIds.size} selectionne{selectedIds.size > 1 ? 's' : ''}
            </Text>

            <View style={styles.selectionActions}>
              <Pressable
                style={({ pressed }) => [styles.selectionActionBtn, styles.removeBtn, pressed && styles.pressed]}
                onPress={handleBatchRemove}
                disabled={removingIds.size > 0}
              >
                {removingIds.size > 0 ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <>
                    <Trash2 size={14} color={colors.error} />
                    <Text style={styles.removeText}>Retirer</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.selectionActionBtn, styles.quizBtn, pressed && styles.pressed]}
                onPress={handleStartSelectionQuiz}
              >
                <Brain size={14} color={colors.background} />
                <Text style={styles.quizText}>Quiz</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: GRID_PADDING,
    paddingBottom: spacing.xl,
  },
  illustration: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  illustrationEmoji: {
    fontSize: 80,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerName: {
    marginBottom: spacing.xs,
  },
  description: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  // Action buttons row
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  quizHint: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginTop: spacing.md,
  },
  gridItem: {
    width: COLUMN_WIDTH,
  },

  // Selection bar
  selectionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  selectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionCancelBtn: {
    padding: spacing.sm,
  },
  selectionCount: {
    flex: 1,
    textAlign: 'center',
  },
  selectionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  selectionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  removeBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.error,
  },
  quizBtn: {
    backgroundColor: colors.accent,
  },
  removeText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '600',
  },
  quizText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
