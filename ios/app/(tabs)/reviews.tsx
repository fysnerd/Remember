/**
 * Reviews Tab - Revisions screen with Themes / Contenus sub-tabs
 */

import { useState, useCallback } from 'react';
import { View, ScrollView, RefreshControl, Pressable, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Search } from 'lucide-react-native';
import { Text } from '../../components/ui';
import { SearchInput } from '../../components/explorer/SearchInput';
import { RevisionCard } from '../../components/reviews/RevisionCard';
import { CategoryChips } from '../../components/reviews/CategoryChips';
import { ThemeGridCard } from '../../components/explorer/ThemeGridCard';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { useCompletedItems, useDebouncedValue } from '../../hooks';
import { colors, spacing } from '../../theme';
import { STAGGER_DELAY, STAGGER_CAP } from '../../lib/animations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = spacing.sm;
const GRID_PADDING = spacing.lg;
const COLUMN_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

type ReviewTab = 'themes' | 'contents';

export default function ReviewsScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();
  const { data, isLoading } = useCompletedItems();

  // Local state
  const [activeTab, setActiveTab] = useState<ReviewTab>('themes');
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
  const themes = data?.themes ?? [];
  const hasAnyData = contents.length > 0 || themes.length > 0;

  if (!hasAnyData) {
    return (
      <EmptyState
        message="Aucun memo disponible. Faites un quiz pour debloquer les memos !"
        icon={FileText}
        hasHeader
      />
    );
  }

  // --- Themes tab ---
  const handleThemePress = (themeId: string) => {
    router.push({ pathname: '/theme/[id]' as any, params: { id: themeId } });
  };

  const renderThemesTab = () => {
    if (themes.length === 0) {
      return (
        <View style={styles.emptyFilterContainer}>
          <FileText size={40} color={colors.textSecondary} strokeWidth={1.5} />
          <Text variant="body" color="secondary" style={styles.emptyFilterText}>
            Aucun theme revise pour le moment
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.themesGrid}>
        {themes.map((theme, index) => (
          <Animated.View
            key={theme.id}
            style={styles.themeGridItem}
            entering={FadeInDown.delay(Math.min(index, STAGGER_CAP) * STAGGER_DELAY).duration(200)}
          >
            <ThemeGridCard
              emoji={theme.emoji}
              name={theme.name}
              contentCount={theme.quizzedContentCount}
              dueCards={0}
              onPress={() => handleThemePress(theme.id)}
            />
          </Animated.View>
        ))}
      </View>
    );
  };

  // --- Contents tab ---
  const filteredContents = selectedCategory === 'all'
    ? contents
    : contents.filter((item) => item.source === selectedCategory);

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

  const renderContentsTab = () => (
    <>
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
    </>
  );

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
      {/* Sub-tabs: Themes | Contenus */}
      <View style={styles.topTabBar}>
        <Pressable style={styles.topTab} onPress={() => setActiveTab('themes')}>
          <Text
            variant="body"
            weight={activeTab === 'themes' ? 'medium' : 'regular'}
            style={activeTab === 'themes' ? styles.topTabTextActive : styles.topTabTextInactive}
          >
            Themes
          </Text>
          {activeTab === 'themes' && <View style={styles.topTabIndicator} />}
        </Pressable>
        <Pressable style={styles.topTab} onPress={() => setActiveTab('contents')}>
          <Text
            variant="body"
            weight={activeTab === 'contents' ? 'medium' : 'regular'}
            style={activeTab === 'contents' ? styles.topTabTextActive : styles.topTabTextInactive}
          >
            Contenus
          </Text>
          {activeTab === 'contents' && <View style={styles.topTabIndicator} />}
        </Pressable>
      </View>

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
        {activeTab === 'themes' ? renderThemesTab() : renderContentsTab()}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // --- Sub-tabs ---
  topTabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  topTab: {
    paddingVertical: spacing.sm,
    position: 'relative',
  },
  topTabTextActive: {
    color: colors.text,
  },
  topTabTextInactive: {
    color: colors.textTertiary,
  },
  topTabIndicator: {
    position: 'absolute',
    bottom: -spacing.md,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.accent,
    borderRadius: 1,
  },

  // --- Themes grid ---
  themesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    padding: spacing.lg,
  },
  themeGridItem: {
    width: COLUMN_WIDTH,
  },

  // --- Contents ---
  searchContainer: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  emptyFilterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  emptyFilterText: {
    textAlign: 'center',
  },
});
