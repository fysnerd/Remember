/**
 * Feed Tab - Topics (2 columns) + Suggestions
 */

import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Dimensions, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Text, Card } from '../../components/ui';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { useTopics, useContentList } from '../../hooks';
import { colors, spacing, borderRadius } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = spacing.sm;
const GRID_PADDING = spacing.lg;
const COLUMN_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

const sourceEmoji: Record<string, string> = {
  youtube: '🎬',
  spotify: '🎧',
  tiktok: '📱',
  instagram: '📷',
};

export default function FeedScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data: topics, isLoading: topicsLoading } = useTopics();
  const { data: contentData, isLoading: contentLoading } = useContentList();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['topics'] });
    await queryClient.invalidateQueries({ queryKey: ['content'] });
    setRefreshing(false);
  }, [queryClient]);

  const handleTopicPress = (topic: string) => {
    router.push({ pathname: '/topic/[name]', params: { name: topic } });
  };

  const handleContentPress = (id: string) => {
    router.push({ pathname: '/content/[id]', params: { id } });
  };

  if (topicsLoading || contentLoading) {
    return <LoadingScreen />;
  }

  const topicNames = topics ?? [];
  const suggestions = contentData?.items?.slice(0, 5) ?? [];

  if (topicNames.length === 0 && suggestions.length === 0) {
    return <EmptyState message="Connectez vos plateformes pour voir du contenu" icon="🔗" hasHeader />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
      }
    >
      {/* Topics Section - 2 columns grid */}
      {topicNames.length > 0 && (
        <View style={styles.section}>
          <Text variant="h3" style={styles.sectionTitle}>
            Topics
          </Text>
          <View style={styles.topicsGrid}>
            {topicNames.map((topic) => (
              <Pressable
                key={topic}
                style={({ pressed }) => [styles.topicCard, pressed && styles.topicCardPressed]}
                onPress={() => handleTopicPress(topic)}
              >
                <Text variant="body" weight="medium" numberOfLines={2} style={styles.topicLabel}>
                  {topic}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Suggestions Section */}
      {suggestions.length > 0 && (
        <View style={styles.section}>
          <Text variant="h3" style={styles.sectionTitle}>
            Suggestions
          </Text>
          <View style={styles.suggestionsList}>
            {suggestions.map((item) => (
              <Card
                key={item.id}
                padding="md"
                onPress={() => handleContentPress(item.id)}
                style={styles.suggestionCard}
              >
                <View style={styles.suggestionRow}>
                  <Text variant="h2" style={styles.emoji}>
                    {sourceEmoji[item.source] || '📄'}
                  </Text>
                  <Text variant="body" numberOfLines={2} style={styles.suggestionTitle}>
                    {item.title}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  topicCard: {
    width: COLUMN_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topicCardPressed: {
    opacity: 0.7,
    backgroundColor: colors.border,
  },
  topicLabel: {
    textAlign: 'center',
  },
  suggestionsList: {
    gap: spacing.md,
  },
  suggestionCard: {
    marginBottom: 0,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  suggestionTitle: {
    flex: 1,
  },
});
