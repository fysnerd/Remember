/**
 * Home Tab - Daily learning experience
 *
 * Layout:
 * 1. Progress tracker (segments + streak flame)
 * 2. Greeting header
 * 3. Digest CTA — primary daily action (launches interleaved digest)
 * 4. Recommendation cards — 3 optional content/theme quizzes
 */

import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Link2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { GreetingHeader } from '../../components/home/GreetingHeader';
import { DailyProgressTracker } from '../../components/home/DailyProgressTracker';
import { DigestCTA } from '../../components/home/DigestCTA';
import { QuizRecommendationCard } from '../../components/home/QuizRecommendationCard';
import { STAGGER_DELAY, STAGGER_CAP } from '../../lib/animations';
import { useQuizRecommendations, usePipelineStatus, useReviewStats } from '../../hooks';
import { useAuthStore } from '../../stores/authStore';
import { Text } from '../../components/ui';
import { colors, spacing, depth, fonts, typography } from '../../theme';

export default function HomeScreen() {
  const { t } = useTranslation();
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
  const dueCount = reviewStats?.dueToday ?? 0;
  const currentStreak = reviewStats?.currentStreak ?? 0;

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

  const handleDigestPress = () => {
    router.push('/digest' as any);
  };

  const handleRecommendationPress = (rec: { id: string; type: 'content' | 'theme'; dailyRecId?: string; completed?: boolean }) => {
    if (rec.completed) {
      Alert.alert(
        t('home.quizDone'),
        t('home.quizDoneToday'),
      );
      return;
    }
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
    return <EmptyState message={t('home.connectPlatforms')} icon={Link2} hasHeader />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.lg }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
        }
      >
        {dailyProgress && (
          <DailyProgressTracker
            completed={dailyProgress.completed}
            total={dailyProgress.total}
            streak={currentStreak}
          />
        )}
        <GreetingHeader userName={userName} />

        {/* Primary CTA — Daily digest (interleaved session) */}
        <DigestCTA
          dueCount={dueCount}
          streak={currentStreak}
          onPress={handleDigestPress}
        />

        {/* Secondary — Recommendation cards */}
        {recommendations.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              {t('home.pickASubject', { defaultValue: 'Ou choisis un sujet' })}
            </Text>
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
          </>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    ...typography.body,
    letterSpacing: -0.3,
    marginBottom: spacing.md,
  },
  cardsList: {
    gap: spacing.lg,
  },
});
