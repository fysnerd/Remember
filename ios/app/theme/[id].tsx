/**
 * Theme Detail Screen - Shows theme info and its content items
 */

import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Inbox } from 'lucide-react-native';
import { Text, Card, Button } from '../../components/ui';
import { PlatformIcon } from '../../components/icons';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { useThemeDetail } from '../../hooks';
import { colors, spacing } from '../../theme';

export default function ThemeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading } = useThemeDetail(id);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['themes', id] });
    setRefreshing(false);
  }, [queryClient, id]);

  const handleContentPress = (contentId: string) => {
    router.push({ pathname: '/content/[id]', params: { id: contentId } });
  };

  const handleStartQuiz = () => {
    if (id) {
      router.push({
        pathname: '/quiz/theme/[id]' as any,
        params: { id },
      });
    }
  };

  const handleViewMemo = () => {
    if (id) {
      router.push({
        pathname: '/memo/theme/[id]' as any,
        params: { id },
      });
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  const theme = data?.theme;
  const contents = data?.contents ?? [];
  const canQuiz = theme?.canQuiz ?? false;
  const quizReadyCount = theme?.quizReadyCount ?? 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: theme?.name ?? '',
          headerBackTitle: 'Home',
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
        }
      >
        {/* Theme Header */}
        <View style={styles.header}>
          <Text style={styles.headerEmoji}>{theme?.emoji}</Text>
          <Text variant="h2" style={styles.headerName}>
            {theme?.name}
          </Text>
          <Text variant="caption" color="secondary">
            {theme?.contentCount ?? 0} contenu{(theme?.contentCount ?? 0) !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Content List */}
        {contents.length === 0 ? (
          <EmptyState message="Aucun contenu dans ce theme" icon={Inbox} />
        ) : (
          <View style={styles.list}>
            {contents.map((item) => (
              <Card
                key={item.id}
                padding="md"
                onPress={() => handleContentPress(item.id)}
                style={styles.card}
              >
                <View style={styles.row}>
                  <View style={styles.iconContainer}>
                    <PlatformIcon platform={item.source} size={20} colored />
                  </View>
                  <View style={styles.info}>
                    <Text variant="body" weight="medium" numberOfLines={2}>
                      {item.title}
                    </Text>
                    {item.channelName && (
                      <Text variant="caption" color="secondary">
                        {item.channelName}
                      </Text>
                    )}
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Action buttons - always visible */}
        <View style={styles.actionButtons}>
          <Button
            variant="primary"
            fullWidth
            onPress={handleStartQuiz}
            disabled={!canQuiz}
          >
            {canQuiz
              ? `Quiz ${theme?.name}`
              : `Quiz (${quizReadyCount}/3 contenus)`}
          </Button>
          {!canQuiz && (
            <Text variant="caption" color="secondary" style={styles.quizHint}>
              Il faut au moins 3 contenus avec quiz pour lancer un quiz theme.
            </Text>
          )}
          <View style={{ marginTop: spacing.sm }}>
            <Button
              variant="secondary"
              fullWidth
              onPress={handleViewMemo}
            >
              Memo {theme?.name}
            </Button>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  headerName: {
    marginBottom: spacing.xs,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    marginBottom: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: spacing.md,
  },
  info: {
    flex: 1,
  },
  actionButtons: {
    marginTop: spacing.xl,
  },
  quizHint: {
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
