/**
 * Quiz Preview Screen - Synopsis before starting a quiz
 */

import { View, ScrollView, StyleSheet, Image, Pressable, Linking } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Button } from '../../../components/ui';
import { PlatformIcon } from '../../../components/icons';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ErrorState } from '../../../components/ErrorState';
import { useContent, useQuiz, useThemeDetail, useThemeQuiz } from '../../../hooks';
import { colors, spacing, borderRadius } from '../../../theme';

const sourceLabel: Record<string, string> = {
  youtube: 'YouTube',
  spotify: 'Spotify',
  tiktok: 'TikTok',
  instagram: 'Instagram',
};

export default function QuizPreviewScreen() {
  const { id, type, contentIds } = useLocalSearchParams<{
    id: string;
    type: 'content' | 'theme';
    contentIds?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isTheme = type === 'theme';

  // Content hooks (only enabled for content type)
  const { data: content, isLoading: contentLoading } = useContent(isTheme ? '' : id!);
  const { data: quiz, isLoading: quizLoading } = useQuiz(isTheme ? '' : id!);

  // Theme hooks (only enabled for theme type)
  const { data: themeData, isLoading: themeLoading } = useThemeDetail(isTheme ? id : undefined);
  const { data: themeQuiz, isLoading: themeQuizLoading } = useThemeQuiz(isTheme ? id! : '');

  const isLoading = isTheme
    ? themeLoading || themeQuizLoading
    : contentLoading || quizLoading;

  if (isLoading) {
    return <LoadingScreen />;
  }

  // Extract display data
  const theme = themeData?.theme;
  const questions = isTheme ? themeQuiz?.questions : quiz?.questions;
  const questionCount = questions?.length ?? 0;
  const firstQuestion = questions?.[0];

  const title = isTheme ? theme?.name : content?.title;
  const subtitle = isTheme
    ? `${theme?.contentCount ?? 0} contenu${(theme?.contentCount ?? 0) !== 1 ? 's' : ''}`
    : [sourceLabel[content?.source ?? ''], content?.channelName].filter(Boolean).join(' \u2022 ');

  if (questionCount === 0) {
    return (
      <>
        <Stack.Screen options={{ title: '', headerBackTitle: 'Retour' }} />
        <ErrorState message="Aucun quiz disponible" onRetry={() => router.back()} hasHeader />
      </>
    );
  }

  const handleStart = () => {
    if (isTheme) {
      router.replace({
        pathname: '/quiz/theme/[id]' as any,
        params: contentIds ? { id: id!, contentIds } : { id: id! },
      });
    } else {
      router.replace({ pathname: '/quiz/[id]' as any, params: { id: id! } });
    }
  };

  const handleOpenSource = () => {
    if (content?.url) Linking.openURL(content.url);
  };

  return (
    <>
      <Stack.Screen options={{ title: '', headerBackTitle: 'Retour' }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Visual */}
          {isTheme ? (
            <View style={styles.emojiContainer}>
              <Text style={styles.emoji}>{theme?.emoji}</Text>
            </View>
          ) : content?.thumbnailUrl ? (
            <Image
              source={{ uri: content.thumbnailUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
              <PlatformIcon platform={content?.source ?? ''} size={48} colored />
            </View>
          )}

          {/* Title */}
          <Text variant="h1" style={styles.title}>{title}</Text>

          {/* Subtitle */}
          {subtitle ? (
            <View style={styles.subtitleRow}>
              {!isTheme && content?.source && (
                <PlatformIcon platform={content.source} size={14} colored />
              )}
              <Text variant="body" color="secondary">{subtitle}</Text>
            </View>
          ) : null}

          {/* Source link (content only) */}
          {!isTheme && content?.url && (
            <Pressable onPress={handleOpenSource} style={styles.sourceLink}>
              <Text variant="caption" style={styles.sourceLinkText}>
                Voir l'original →
              </Text>
            </Pressable>
          )}

          {/* Composition badge */}
          <View style={styles.compositionBadge}>
            <Text variant="body" weight="medium">
              {questionCount} question{questionCount !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* First question synopsis */}
          {firstQuestion && (
            <View style={styles.synopsisCard}>
              <Text variant="caption" color="secondary" style={styles.synopsisLabel}>
                Exemple
              </Text>
              <Text variant="body" weight="medium">
                {firstQuestion.question}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Sticky bottom button */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button variant="primary" fullWidth size="lg" onPress={handleStart}>
            Commencer
          </Button>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  // Theme emoji
  emojiContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    marginBottom: spacing.md,
  },
  emoji: {
    fontSize: 80,
  },
  // Content thumbnail
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  thumbnailPlaceholder: {
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  sourceLink: {
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
  },
  sourceLinkText: {
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  compositionBadge: {
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  synopsisCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  synopsisLabel: {
    marginBottom: spacing.sm,
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
