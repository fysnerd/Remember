/**
 * Reviews Tab - List of completed quiz sessions with theme filter + search
 */

import { useCallback, useRef, useState, useMemo } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet, Pressable, Alert } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Search, Trash2 } from 'lucide-react-native';
import { SessionCard } from '../../components/reviews/SessionCard';
import { SearchInput } from '../../components/explorer/SearchInput';
import { ThemePills } from '../../components/reviews/ThemePills';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { Text } from '../../components/ui';
import { useCompletedSessions, useDeleteSession, useDebouncedValue } from '../../hooks';
import type { QuizSessionTheme } from '../../hooks';
import { colors, spacing, borderRadius } from '../../theme';
import { STAGGER_DELAY, STAGGER_CAP } from '../../lib/animations';

export default function ReviewsScreen() {
  const router = useRouter();
  const { bottom: bottomInset, top: topInset } = useSafeAreaInsets();
  const tabBarHeight = bottomInset + 49;
  const queryClient = useQueryClient();
  const { data: sessions, isLoading } = useCompletedSessions();
  const deleteSession = useDeleteSession();
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);

  const handleDelete = useCallback((sessionId: string, title: string) => {
    Alert.alert(
      'Supprimer cette fiche',
      `Supprimer "${title}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel', onPress: () => swipeableRefs.current.get(sessionId)?.close() },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => deleteSession.mutate(sessionId),
        },
      ],
    );
  }, [deleteSession]);

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

    if (selectedThemeIds.length > 0) {
      result = result.filter((s) =>
        s.themes.some((t) => selectedThemeIds.includes(t.id))
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
  }, [sessions, selectedThemeIds, debouncedSearch]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!sessions || sessions.length === 0) {
    return (
      <EmptyState
        message="Aucune révision pour le moment. Faites un quiz pour commencer !"
        icon={FileText}
        hasHeader
      />
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(200)} style={[styles.container, { paddingTop: topInset }]}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Rechercher une révision..."
        />
      </View>

      {/* Theme filter pills */}
      <ThemePills
        themes={availableThemes}
        selectedThemeIds={selectedThemeIds}
        onThemeToggle={(id) => setSelectedThemeIds((prev) =>
          prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
        )}
        onClearAll={() => setSelectedThemeIds([])}
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
                <Swipeable
                  ref={(ref) => {
                    if (ref) swipeableRefs.current.set(session.id, ref);
                    else swipeableRefs.current.delete(session.id);
                  }}
                  renderRightActions={() => (
                    <Pressable
                      style={styles.deleteAction}
                      onPress={() => handleDelete(session.id, session.contents[0]?.title || 'cette fiche')}
                    >
                      <Trash2 size={18} color="#FFFFFF" />
                      <Text style={styles.deleteText}>Supprimer</Text>
                    </Pressable>
                  )}
                  overshootRight={false}
                  rightThreshold={40}
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
                </Swipeable>
              </Animated.View>
            ))}
          </View>
        ) : (
          <EmptyState
            message="Aucun résultat pour cette recherche"
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  deleteAction: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginLeft: spacing.sm,
    gap: 4,
  },
  deleteText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
