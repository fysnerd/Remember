/**
 * Home Tab - Daily learning experience with greeting, stats, and 3 fixed daily quiz cards
 */

import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Link2 } from 'lucide-react-native';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { GreetingHeader } from '../../components/home/GreetingHeader';
import { QuizRecommendationCard } from '../../components/home/QuizRecommendationCard';
import { DailyVictoryScreen } from '../../components/home/DailyVictoryScreen';
import { STAGGER_DELAY, STAGGER_CAP } from '../../lib/animations';
import { useQuizRecommendations, usePipelineStatus, useReviewStats } from '../../hooks';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing } from '../../theme';

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const tabBarHeight = bottomInset + 49;
  const [refreshing, setRefreshing] = useState(false);

  const { user } = useAuthStore();
  const { data, isLoading } = useQuizRecommendations();
  const { data: reviewStats } = useReviewStats();
  // Pipeline polling — runs on home screen, fires haptic when content becomes ready
  usePipelineStatus();

  const userName = user?.name || user?.email?.split('@')[0] || 'there';

  const recommendations = data?.recommendations ?? [];
  const dailyProgress = data?.dailyProgress;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['home', 'recommendations'] }),
        queryClient.invalidateQueries({ queryKey: ['reviews', 'stats'] }),
      ]);
    } catch (error) {
      console.error('[Home] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  const handleRecommendationPress = (rec: { id: string; type: 'content' | 'theme'; dailyRecId?: string }) => {
    if (rec.type === 'content') {
      router.push({
        pathname: '/content/[id]' as any,
        params: { id: rec.id, dailyRecId: rec.dailyRecId || '' },
      });
    } else {
      router.push({
        pathname: '/quiz/preview/[id]' as any,
        params: { id: rec.id, type: rec.type, dailyRecId: rec.dailyRecId || '' },
      });
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (recommendations.length === 0) {
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
        <GreetingHeader userName={userName} streak={reviewStats?.currentStreak ?? 0} />

        {dailyProgress?.allDone ? (
          <DailyVictoryScreen streak={reviewStats?.currentStreak ?? 0} />
        ) : (
          <View style={styles.cardsList}>
            {recommendations.map((rec, index) => (
              <Animated.View
                key={rec.id}
                entering={FadeInDown.delay(Math.min(index, STAGGER_CAP) * STAGGER_DELAY).duration(250)}
              >
                <QuizRecommendationCard
                  recommendation={rec}
                  onPress={() => handleRecommendationPress(rec)}
                />
              </Animated.View>
            ))}
          </View>
        )}
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
  cardsList: {
    gap: spacing.lg,
  },
});
