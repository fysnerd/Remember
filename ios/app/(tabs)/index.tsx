/**
 * Home Tab - Daily learning experience with greeting, stats, and 3 daily theme cards
 */

import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { ChevronRight, Link2 } from 'lucide-react-native';
import { Text } from '../../components/ui';
import { GlassCard } from '../../components/glass/GlassCard';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { GreetingHeader } from '../../components/home/GreetingHeader';
import { DailyThemeCard } from '../../components/home/DailyThemeCard';
import { STAGGER_DELAY, STAGGER_CAP } from '../../lib/animations';
import { useDailyThemes, usePendingThemes, useReviewStats } from '../../hooks';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing } from '../../theme';

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const [refreshing, setRefreshing] = useState(false);

  const { user } = useAuthStore();
  const { data: dailyThemes, isLoading: themesLoading } = useDailyThemes();
  const { data: stats } = useReviewStats();
  const { data: pendingThemes } = usePendingThemes();

  const pendingCount = pendingThemes?.length ?? 0;
  const userName = user?.name || user?.email?.split('@')[0] || 'there';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['themes'] }),
      queryClient.invalidateQueries({ queryKey: ['reviews', 'stats'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const handleThemePress = (themeId: string) => {
    router.push({ pathname: '/theme/[id]' as any, params: { id: themeId } });
  };

  if (themesLoading) {
    return <LoadingScreen />;
  }

  const themeList = dailyThemes ?? [];

  if (themeList.length === 0) {
    return <EmptyState message="Connectez vos plateformes pour commencer" icon={Link2} hasHeader />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.lg }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
      }
    >
      <GreetingHeader userName={userName} stats={stats} />

      {/* Discovery banner */}
      {pendingCount > 0 && (
        <Animated.View entering={FadeInDown.duration(250)}>
          <GlassCard padding="md" onPress={() => router.push('/theme-discovery' as any)}>
            <View style={styles.discoveryRow}>
              <View style={styles.discoveryContent}>
                <Text variant="body" weight="medium">
                  {pendingCount} nouveau{pendingCount > 1 ? 'x' : ''} theme{pendingCount > 1 ? 's' : ''} detecte{pendingCount > 1 ? 's' : ''}
                </Text>
                <Text variant="caption" color="secondary">
                  Revoyez et confirmez vos themes
                </Text>
              </View>
              <ChevronRight size={24} color={colors.textSecondary} strokeWidth={1.75} />
            </View>
          </GlassCard>
        </Animated.View>
      )}

      {/* Daily themes section */}
      <Text variant="h3" style={styles.sectionTitle}>
        Themes du jour
      </Text>

      <View style={styles.themesList}>
        {themeList.map((theme, index) => (
          <Animated.View
            key={theme.id}
            entering={FadeInDown.delay(Math.min(index, STAGGER_CAP) * STAGGER_DELAY).duration(250)}
          >
            <DailyThemeCard
              theme={theme}
              onPress={() => handleThemePress(theme.id)}
            />
          </Animated.View>
        ))}
      </View>
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
  discoveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discoveryContent: {
    flex: 1,
  },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  themesList: {
    gap: spacing.md,
  },
});
