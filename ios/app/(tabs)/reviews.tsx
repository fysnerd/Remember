/**
 * Reviews Tab - List of completed quiz sessions
 */

import { useCallback, useState } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react-native';
import { Text } from '../../components/ui';
import { SessionCard } from '../../components/reviews/SessionCard';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { useCompletedSessions } from '../../hooks';
import { colors, spacing } from '../../theme';
import { STAGGER_DELAY, STAGGER_CAP } from '../../lib/animations';

export default function ReviewsScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();
  const { data: sessions, isLoading } = useCompletedSessions();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['reviews', 'sessions'] });
    setRefreshing(false);
  }, [queryClient]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!sessions || sessions.length === 0) {
    return (
      <EmptyState
        message="Aucune revision pour le moment. Faites un quiz pour commencer !"
        icon={FileText}
        hasHeader
      />
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: tabBarHeight + spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textSecondary}
          />
        }
      >
        <View style={styles.list}>
          {sessions.map((session, index) => (
            <Animated.View
              key={session.id}
              entering={FadeInDown.delay(Math.min(index, STAGGER_CAP) * STAGGER_DELAY).duration(200)}
            >
              <SessionCard
                session={session}
                onPress={() => router.push({ pathname: '/memo/session/[id]' as any, params: { id: session.id } })}
              />
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
});
