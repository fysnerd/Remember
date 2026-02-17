/**
 * Session Memo Screen - AI-generated memo for a specific quiz session
 */

import { useEffect } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Share, Image } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Text, Button, useToast } from '../../../components/ui';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ErrorState } from '../../../components/ErrorState';
import { PlatformIcon } from '../../../components/icons/PlatformIcon';
import { useSessionDetail, useGenerateSessionMemo } from '../../../hooks';
import { colors, spacing, borderRadius } from '../../../theme';

const markdownStyles = {
  body: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  heading1: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700' as const,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  heading2: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '600' as const,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  heading3: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600' as const,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  paragraph: {
    marginBottom: spacing.md,
    lineHeight: 24,
  },
  bullet_list: {
    marginBottom: spacing.md,
  },
  ordered_list: {
    marginBottom: spacing.md,
  },
  list_item: {
    marginBottom: spacing.xs,
  },
  strong: {
    fontWeight: '600' as const,
  },
  em: {
    fontStyle: 'italic' as const,
  },
  blockquote: {
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
    borderLeftColor: colors.border,
    paddingLeft: spacing.md,
    paddingVertical: spacing.sm,
    marginVertical: spacing.md,
  },
};

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 80) return colors.success;
  if (accuracy >= 50) return '#F59E0B';
  return colors.error;
}

export default function SessionMemoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: session, isLoading, error, refetch } = useSessionDetail(id);
  const memoMutation = useGenerateSessionMemo();
  const { show, ToastComponent } = useToast();

  // Auto-generate memo only once if session is completed but has no memo yet
  useEffect(() => {
    if (session && session.completedAt && !session.aiMemo && !memoMutation.isPending && !memoMutation.isSuccess && !memoMutation.isError) {
      memoMutation.mutate({ sessionId: id! });
    }
  }, [session?.id]); // Only trigger on first load, not on aiMemo changes

  const memo = memoMutation.data?.memo ?? session?.aiMemo;

  const handleShare = async () => {
    if (!memo) return;
    try {
      await Share.share({ message: memo, title: 'Memo de session' });
    } catch {
      show('Erreur lors du partage', 'error');
    }
  };

  if (isLoading) return <LoadingScreen />;
  if (!session) return <ErrorState message="Session introuvable" onRetry={refetch} hasHeader />;

  // Extract unique contents from reviews
  const contentMap = new Map<string, { id: string; title: string; platform: string; thumbnailUrl?: string }>();
  for (const review of session.reviews ?? []) {
    const content = review.card?.quiz?.content;
    if (!content) continue;
    if (!contentMap.has(content.id)) {
      contentMap.set(content.id, content);
    }
  }
  const contents = Array.from(contentMap.values());

  const totalCount = session.totalCount ?? session.reviews?.length ?? 0;
  const correctCount = session.correctCount ?? 0;
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const accuracyColor = getAccuracyColor(accuracy);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Memo',
          headerBackTitle: 'Retour',
          headerRight: () => memo ? (
            <Pressable
              onPress={handleShare}
              hitSlop={8}
              style={styles.shareButton}
            >
              <Text variant="body" style={{ textAlign: 'center' }}>📤</Text>
            </Pressable>
          ) : null,
        }}
      />
      <ToastComponent />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}
      >
        {/* Session header */}
        <Animated.View entering={FadeIn.duration(200)} style={styles.header}>
          <View style={styles.headerTop}>
            <View style={[styles.badge, { backgroundColor: accuracyColor + '20' }]}>
              <Text variant="body" weight="medium" style={{ color: accuracyColor }}>
                {accuracy}%
              </Text>
            </View>
            <Text variant="caption" color="secondary">
              {totalCount} question{totalCount > 1 ? 's' : ''} {'\u2022'} {new Date(session.completedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          {/* Content thumbnails */}
          {contents.length > 0 && (
            <View style={styles.contentsList}>
              {contents.slice(0, 5).map(c => (
                <View key={c.id} style={styles.contentChip}>
                  {c.thumbnailUrl ? (
                    <Image source={{ uri: c.thumbnailUrl }} style={styles.chipThumb} />
                  ) : (
                    <PlatformIcon platform={c.platform.toLowerCase()} size={14} colored />
                  )}
                  <Text variant="caption" color="secondary" numberOfLines={1} style={styles.chipText}>
                    {c.title}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Memo content */}
        {memoMutation.isPending ? (
          <View style={styles.loadingMemo}>
            <Text variant="body" color="secondary">Generation du memo...</Text>
          </View>
        ) : memo ? (
          <Markdown style={markdownStyles}>{memo}</Markdown>
        ) : (
          <View style={styles.loadingMemo}>
            <Text variant="body" color="secondary">Aucun memo disponible</Text>
          </View>
        )}

        {/* Actions */}
        {memo && (
          <View style={styles.actions}>
            <Button variant="primary" fullWidth onPress={() => router.back()}>
              OK
            </Button>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  contentsList: {
    gap: spacing.sm,
  },
  contentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chipThumb: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.xs,
  },
  chipText: {
    flex: 1,
  },
  loadingMemo: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
});
