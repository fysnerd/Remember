/**
 * Quiz Preview Screen - Theme preview before starting a quiz
 */

import { View, ScrollView, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Button } from '../../../components/ui';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ErrorState } from '../../../components/ErrorState';
import { useThemeDetail, useThemeQuiz } from '../../../hooks';
import { colors, spacing, borderRadius } from '../../../theme';

/** Build a short description from the content titles in this theme */
function buildTopicsSummary(contents: { title: string }[], max = 5): string {
  if (!contents.length) return '';
  const titles = contents.slice(0, max).map((c) => c.title);
  const summary = titles.join(' · ');
  if (contents.length > max) {
    return `${summary} … et ${contents.length - max} autres`;
  }
  return summary;
}

export default function QuizPreviewScreen() {
  const { id, type, contentIds, dailyRecId } = useLocalSearchParams<{
    id: string;
    type: 'content' | 'theme';
    contentIds?: string;
    dailyRecId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: themeData, isLoading: themeLoading } = useThemeDetail(id);
  const { data: themeQuiz, isLoading: themeQuizLoading } = useThemeQuiz(id ?? '');

  const isLoading = themeLoading || themeQuizLoading;

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: '', headerBackTitle: 'Retour', headerShadowVisible: false, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text }} />
        <LoadingScreen />
      </>
    );
  }

  const theme = themeData?.theme;
  const contents = themeData?.contents ?? [];
  const questionCount = themeQuiz?.questions?.length ?? 0;

  if (questionCount === 0) {
    return (
      <>
        <Stack.Screen options={{ title: '', headerBackTitle: 'Retour' }} />
        <ErrorState message="Aucun quiz disponible" onRetry={() => router.back()} hasHeader />
      </>
    );
  }

  const handleStart = () => {
    const params: any = { id: id! };
    if (contentIds) params.contentIds = contentIds;
    if (dailyRecId) params.dailyRecId = dailyRecId;
    router.replace({
      pathname: '/quiz/theme/[id]' as any,
      params,
    });
  };

  const topicsSummary = buildTopicsSummary(contents);

  return (
    <>
      <Stack.Screen options={{ title: '', headerBackTitle: 'Retour' }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Emoji */}
          <View style={styles.emojiContainer}>
            <Text style={styles.emoji}>{theme?.emoji}</Text>
          </View>

          {/* Title */}
          <Text variant="h1" style={styles.title}>{theme?.name}</Text>

          {/* Subtitle */}
          <Text variant="body" color="secondary" style={styles.subtitle}>
            {theme?.contentCount ?? 0} contenu{(theme?.contentCount ?? 0) !== 1 ? 's' : ''} · {questionCount} question{questionCount !== 1 ? 's' : ''}
          </Text>

          {/* Topics description */}
          {topicsSummary ? (
            <View style={styles.topicsCard}>
              <Text variant="caption" color="secondary" style={styles.topicsLabel}>
                Sujets abordés
              </Text>
              <Text variant="body" color="secondary">
                {topicsSummary}
              </Text>
            </View>
          ) : null}
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
  emojiContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    marginBottom: spacing.md,
  },
  emoji: {
    fontSize: 80,
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.lg,
  },
  topicsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topicsLabel: {
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
