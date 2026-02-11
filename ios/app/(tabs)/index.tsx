/**
 * Feed Tab - Themes (2 columns) + Suggestions
 */

import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Dimensions, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Link2, ChevronRight } from 'lucide-react-native';
import { Text, Card } from '../../components/ui';
import { PlatformIcon } from '../../components/icons';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { ThemeCard } from '../../components/ThemeCard';
import { useThemes, usePendingThemes, useContentList } from '../../hooks';
import { colors, spacing, borderRadius } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = spacing.sm;
const GRID_PADDING = spacing.lg;
const COLUMN_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

export default function FeedScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const [refreshing, setRefreshing] = useState(false);
  const { data: themes, isLoading: themesLoading } = useThemes();
  const { data: pendingThemes } = usePendingThemes();
  const { data: contentData, isLoading: contentLoading } = useContentList();

  const pendingCount = pendingThemes?.length ?? 0;

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
    return <EmptyState message="Connectez vos plateformes pour voir du contenu" icon={Link2} hasHeader />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.lg }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
      }
    >
      {/* Discovery banner */}
      {pendingCount > 0 && (
        <Pressable
          onPress={() => router.push('/theme-discovery' as any)}
          style={styles.discoveryBanner}
        >
          <View style={styles.discoveryBannerContent}>
            <Text variant="body" weight="medium">
              {pendingCount} nouveau{pendingCount > 1 ? 'x' : ''} theme{pendingCount > 1 ? 's' : ''} detecte{pendingCount > 1 ? 's' : ''}
            </Text>
            <Text variant="caption" color="secondary">
              Revoyez et confirmez vos themes
            </Text>
          </View>
          <ChevronRight size={24} color={colors.textSecondary} strokeWidth={1.75} />
        </Pressable>
      )}

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
                  masteryPercent={theme.masteryPercent ?? 0}
                  dueCards={theme.dueCards ?? 0}
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
                  <View style={styles.suggestionIcon}>
                    <PlatformIcon platform={item.source} size={20} colored />
                  </View>
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
  discoveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  discoveryBannerContent: {
    flex: 1,
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
  suggestionIcon: {
    marginRight: spacing.md,
  },
  suggestionTitle: {
    flex: 1,
  },
});
