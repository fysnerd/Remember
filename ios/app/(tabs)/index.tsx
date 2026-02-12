/**
 * Home Tab - Daily learning experience with greeting, stats, and 3 daily theme cards
 */

import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Link2 } from 'lucide-react-native';
import { GlassLockOverlay } from '../../components/glass';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { GreetingHeader } from '../../components/home/GreetingHeader';
import { DailyThemeCard } from '../../components/home/DailyThemeCard';
import { STAGGER_DELAY, STAGGER_CAP } from '../../lib/animations';
import { useDailyThemes, useReviewStats } from '../../hooks';
import { useSubscription } from '../../hooks/useSubscription';
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
  const { data: subscription } = useSubscription();
  const isFree = subscription?.plan !== 'PRO';

  const userName = user?.name || user?.email?.split('@')[0] || 'there';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['themes'] }),
        queryClient.invalidateQueries({ queryKey: ['reviews', 'stats'] }),
      ]);
    } catch (error) {
      console.error('[Home] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
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
    <SafeAreaView style={styles.container} edges={['top']}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.lg }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
      }
    >
      <GreetingHeader userName={userName} stats={stats} />

      <View style={styles.themesList}>
        {themeList.map((theme, index) => (
          <Animated.View
            key={theme.id}
            entering={FadeInDown.delay(Math.min(index, STAGGER_CAP) * STAGGER_DELAY).duration(250)}
          >
            <GlassLockOverlay locked={isFree && index >= 2}>
              <DailyThemeCard
                theme={theme}
                onPress={() => handleThemePress(theme.id)}
              />
            </GlassLockOverlay>
          </Animated.View>
        ))}
      </View>
    </ScrollView>
    </SafeAreaView>
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
  themesList: {
    gap: spacing.lg,
  },
});
