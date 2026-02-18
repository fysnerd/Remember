/**
 * Multi-Content Quiz Preview Screen
 * Fan stack of thumbnails + content count + question count before starting.
 */

import { View, ScrollView, StyleSheet, Image } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Button } from '../../../components/ui';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { useContentsByIds, useMultiQuiz } from '../../../hooks';
import { colors, spacing, borderRadius } from '../../../theme';

const THUMB_WIDTH = 160;
const THUMB_HEIGHT = 90; // 16:9

// ---------------------------------------------------------------------------
// ThumbnailFanStack – renders up to 3 thumbnails in a fan arrangement
// ---------------------------------------------------------------------------

function ThumbnailFanStack({ thumbnails }: { thumbnails: string[] }) {
  const items = thumbnails.slice(0, 3);
  if (items.length === 0) return null;

  const getTransform = (index: number, total: number) => {
    if (total === 1) return [];
    if (total === 2) {
      const rotation = (index - 0.5) * 8; // -4°, +4°
      const offsetX = (index - 0.5) * 14;
      return [{ rotate: `${rotation}deg` }, { translateX: offsetX }];
    }
    // 3 items: -6°, 0°, +6°
    const rotation = (index - 1) * 6;
    const offsetX = (index - 1) * 10;
    return [{ rotate: `${rotation}deg` }, { translateX: offsetX }];
  };

  return (
    <View style={fanStyles.container}>
      {items.map((url, index) => (
        <View
          key={index}
          style={[
            StyleSheet.absoluteFill,
            { alignItems: 'center', justifyContent: 'center', zIndex: index },
          ]}
        >
          <Image
            source={{ uri: url }}
            style={[
              fanStyles.thumb,
              { transform: getTransform(index, items.length) },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const fanStyles = StyleSheet.create({
  container: {
    width: THUMB_WIDTH + 60,
    height: THUMB_HEIGHT + 50,
    alignSelf: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MultiQuizPreviewScreen() {
  const { ids } = useLocalSearchParams<{ ids: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const contentIds = ids?.split(',').filter(Boolean) ?? [];

  // Fetch content details (for thumbnails)
  const contentQueries = useContentsByIds(contentIds);

  // Prefetch quiz + get question count
  const { data: quizData, isLoading: quizLoading } = useMultiQuiz(contentIds);

  const contentsLoading = contentQueries.some((q) => q.isLoading);
  const contents = contentQueries.map((q) => q.data).filter(Boolean);

  const thumbnails = contents
    .filter((c) => c?.thumbnailUrl)
    .map((c) => c!.thumbnailUrl!)
    .slice(0, 3);

  const questionCount = quizData?.questions?.length ?? 0;
  const isLoading = contentsLoading || quizLoading;

  const handleStart = () => {
    router.replace({
      pathname: '/quiz/[id]' as any,
      params: { id: 'multi', ids: ids! },
    });
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: '', headerBackTitle: 'Retour' }} />
        <LoadingScreen />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: '', headerBackTitle: 'Retour' }} />
      <View style={styles.container}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Thumbnail Fan Stack */}
          <ThumbnailFanStack thumbnails={thumbnails} />

          {/* Title */}
          <Text variant="h1" style={styles.title}>
            {contentIds.length} contenu{contentIds.length > 1 ? 's' : ''} selectionne{contentIds.length > 1 ? 's' : ''}
          </Text>

          {/* Subtitle - question count */}
          <Text variant="body" color="secondary" style={styles.subtitle}>
            {questionCount} question{questionCount !== 1 ? 's' : ''}
          </Text>
        </ScrollView>

        {/* Sticky bottom button */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onPress={handleStart}
            disabled={questionCount === 0}
          >
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
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.lg,
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
