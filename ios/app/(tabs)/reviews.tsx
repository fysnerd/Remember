/**
 * Reviews Tab - List of completed quiz sessions with theme filter + search
 */

import { useCallback, useState, useMemo } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTabBarHeight } from '../../hooks/useTabBarHeight';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Search } from 'lucide-react-native';
import { SessionCard } from '../../components/reviews/SessionCard';
import { SearchInput } from '../../components/explorer/SearchInput';
import { ThemePills } from '../../components/reviews/ThemePills';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { useCompletedSessions, useDebouncedValue } from '../../hooks';
import type { QuizSessionTheme } from '../../hooks';
import { colors, spacing } from '../../theme';
import { STAGGER_DELAY, STAGGER_CAP } from '../../lib/animations';

export default function ReviewsScreen() {
  const router = useRouter();
  const tabBarHeight = useTabBarHeight();
  const queryClient = useQueryClient();
  const { data: sessions, isLoading } = useCompletedSessions();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['reviews', 'sessions'] });
    setRefreshing(false);
  }, [queryClient]);

  // Extract unique themes from all sessions for the pills
  const availableThemes = useMemo(() => {
    if (!sessions) return [];
    const themeMap = new Map<string, QuizSessionTheme>();
    for (const session of sessions) {
      for (const theme of session.themes) {
        if (!themeMap.has(theme.id)) {
          themeMap.set(theme.id, theme);
        }
      }
    }
    return Array.from(themeMap.values());
  }, [sessions]);

  // Filter sessions by theme + search
  const filteredSessions = useMemo(() => {
    if (!sessions) return sessions;
    let result = sessions;

    if (selectedThemeId) {
      result = result.filter((s) =>
        s.themes.some((t) => t.id === selectedThemeId)
      );
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((s) =>
        s.contents.some((c) => c.title.toLowerCase().includes(q)) ||
        s.themes.some((t) => t.name.toLowerCase().includes(q))
      );
    }

    return result;
  }, [sessions, selectedThemeId, debouncedSearch]);

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
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Rechercher une revision..."
        />
      </View>

      {/* Theme filter pills */}
      <ThemePills
        themes={availableThemes}
        selectedThemeId={selectedThemeId}
        onThemeChange={setSelectedThemeId}
      />

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
        {filteredSessions && filteredSessions.length > 0 ? (
          <View style={styles.list}>
            {filteredSessions.map((session, index) => (
              <Animated.View
                key={session.id}
                entering={FadeInDown.delay(Math.min(index, STAGGER_CAP) * STAGGER_DELAY).duration(200)}
              >
                <SessionCard
                  session={session}
                  onPress={() => {
                    const contentId = session.contents[0]?.id;
                    if (contentId) {
                      router.push({ pathname: '/memo/[id]' as any, params: { id: contentId } });
                    }
                  }}
                />
              </Animated.View>
            ))}
          </View>
        ) : (
          <EmptyState
            message="Aucun resultat pour cette recherche"
            icon={Search}
            hasHeader
          />
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
});
