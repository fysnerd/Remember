/**
 * Reviews Tab - Revisions screen with category filter chips, search, and GlassCard items
 *
 * Shows completed content/topics that have been quizzed, with client-side
 * filtering by platform category and full-text search.
 */

import { useState, useCallback } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Search } from 'lucide-react-native';
import { Text } from '../../components/ui';
import { SearchInput } from '../../components/explorer/SearchInput';
import { RevisionCard } from '../../components/reviews/RevisionCard';
import { CategoryChips } from '../../components/reviews/CategoryChips';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { useCompletedItems, useDebouncedValue } from '../../hooks';
import { colors, spacing } from '../../theme';

export default function ReviewsScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();
  const { data, isLoading } = useCompletedItems();

  // Local filter state
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const debouncedSearch = useDebouncedValue(searchText, 300);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['reviews', 'completed'] });
    setRefreshing(false);
  }, [queryClient]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  const contents = data?.items ?? [];
  const hasItems = contents.length > 0;

  if (!hasItems) {
    return (
      <EmptyState
        message="Aucun memo disponible. Faites un quiz pour debloquer les memos !"
        icon={FileText}
        hasHeader
      />
    );
  }

  // Client-side filtering: category (platform)
  const filteredContents = selectedCategory === 'all'
    ? contents
    : contents.filter((item) => item.source === selectedCategory);

  // Client-side filtering: search text
  const searchLower = debouncedSearch.toLowerCase();
  const displayedContents = debouncedSearch
    ? filteredContents.filter((item) =>
        item.contentTitle.toLowerCase().includes(searchLower)
      )
    : filteredContents;

  const hasFilteredResults = displayedContents.length > 0;

  const handleContentMemo = (contentId: string) => {
    router.push(`/memo/${contentId}`);
  };

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <SearchInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Rechercher un memo..."
        />
      </View>

      {/* Category filter chips */}
      <CategoryChips selected={selectedCategory} onSelect={setSelectedCategory} />

      {/* Revision list */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + spacing.lg }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textSecondary}
          />
        }
      >
        {hasFilteredResults ? (
          <View style={styles.list}>
            {displayedContents.map((content) => (
              <RevisionCard
                key={content.id}
                title={content.contentTitle}
                subtitle="Voir le memo"
                platform={content.source}
                onPress={() => handleContentMemo(content.contentId)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyFilterContainer}>
            <Search size={40} color={colors.textSecondary} strokeWidth={1.5} />
            <Text variant="body" color="secondary" style={styles.emptyFilterText}>
              Aucun resultat pour cette recherche
            </Text>
          </View>
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
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  list: {
    gap: spacing.md,
  },
  emptyFilterContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  emptyFilterText: {
    textAlign: 'center',
  },
});
