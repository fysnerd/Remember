/**
 * Feed Tab - Themes (2 columns) + Suggestions
 */

import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Dimensions, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Text, Card } from '../../components/ui';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { ThemeCard } from '../../components/ThemeCard';
import { useThemes, useContentList } from '../../hooks';
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
  const { data: themes, isLoading: themesLoading } = useThemes();
  const { data: contentData, isLoading: contentLoading } = useContentList();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['themes'] });
    await queryClient.invalidateQueries({ queryKey: ['content'] });
    setRefreshing(false);
  }, [queryClient]);

  const handleThemePress = (themeId: string) => {
    router.push({ pathname: '/theme/[id]' as any, params: { id: themeId } });
  };

  const handleContentPress = (id: string) => {
    router.push({ pathname: '/content/[id]', params: { id } });
  };

  if (themesLoading || contentLoading) {
    return <LoadingScreen />;
  }

  const themeList = themes ?? [];
  const suggestions = contentData?.items?.slice(0, 5) ?? [];

  if (themeList.length === 0 && suggestions.length === 0) {
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
      {/* Themes Section - 2 columns grid */}
      {themeList.length > 0 && (
        <View style={styles.section}>
          <Text variant="h3" style={styles.sectionTitle}>
            Themes
          </Text>
          <View style={styles.themesGrid}>
            {themeList.map((theme) => (
              <View key={theme.id} style={styles.themeCardWrapper}>
                <ThemeCard
                  id={theme.id}
                  name={theme.name}
                  emoji={theme.emoji}
                  color={theme.color}
                  contentCount={theme.contentCount}
                  onPress={() => handleThemePress(theme.id)}
                />
              </View>
            ))}
            {/* New Theme Card */}
            <View style={styles.themeCardWrapper}>
              <Pressable
                onPress={() => router.push('/theme-create' as any)}
                style={styles.newThemeCard}
              >
                <Text style={styles.newThemeIcon}>+</Text>
                <Text variant="caption" color="secondary">
                  Nouveau theme
                </Text>
              </Pressable>
            </View>
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
  themesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  themeCardWrapper: {
    width: COLUMN_WIDTH,
  },
  newThemeCard: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    gap: spacing.xs,
  },
  newThemeIcon: {
    fontSize: 24,
    color: colors.textSecondary,
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
