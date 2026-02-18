/**
 * Multi-Content Quiz Preview Screen
 * Same layout as theme detail: centered header, action button, content grid.
 * Fan stack of thumbnails replaces the emoji.
 */

import { View, ScrollView, StyleSheet, Image, Dimensions, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Button } from '../../../components/ui';
import { ContentCard } from '../../../components/content';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { useContentsByIds, useSelectionSummary, useMultiQuiz } from '../../../hooks';
import { colors, spacing, borderRadius } from '../../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = spacing.sm;
const GRID_PADDING = spacing.lg;
const COLUMN_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

const THUMB_WIDTH = 200;
const THUMB_HEIGHT = 112; // 16:9

// ---------------------------------------------------------------------------
// ThumbnailFanStack
// ---------------------------------------------------------------------------

function ThumbnailFanStack({ thumbnails }: { thumbnails: string[] }) {
  const items = thumbnails.slice(0, 3);
  if (items.length === 0) return null;

  const getTransform = (index: number, total: number) => {
    if (total === 1) return [];
    if (total === 2) {
      const rotation = (index - 0.5) * 8;
      const offsetX = (index - 0.5) * 16;
      return [{ rotate: `${rotation}deg` }, { translateX: offsetX }];
    }
    const rotation = (index - 1) * 6;
    const offsetX = (index - 1) * 12;
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
    width: THUMB_WIDTH + 70,
    height: THUMB_HEIGHT + 50,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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

  const contentIds = ids?.split(',').filter(Boolean) ?? [];

  const contentQueries = useContentsByIds(contentIds);
  const { data: summary, isLoading: summaryLoading } = useSelectionSummary(contentIds);
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

  const handleContentPress = (contentId: string) => {
    router.push({ pathname: '/content/[id]', params: { id: contentId } });
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
      <Stack.Screen
        options={{
          title: summary?.name ?? '',
          headerBackTitle: 'Retour',
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        {/* Header - centered */}
        <View style={styles.header}>
          <ThumbnailFanStack thumbnails={thumbnails} />

          {summaryLoading ? (
            <ActivityIndicator color={colors.textSecondary} style={styles.nameLoader} />
          ) : (
            <Text variant="h2" style={styles.headerName}>
              {summary?.name ?? `${contentIds.length} contenu${contentIds.length > 1 ? 's' : ''}`}
            </Text>
          )}

          <Text variant="caption" color="secondary">
            {contentIds.length} contenu{contentIds.length > 1 ? 's' : ''} · {questionCount} question{questionCount !== 1 ? 's' : ''}
          </Text>

          {summary?.description ? (
            <Text variant="caption" color="secondary" style={styles.description}>
              {summary.description}
            </Text>
          ) : null}
        </View>

        {/* Action button */}
        <View style={styles.actionButtons}>
          <Button
            variant="primary"
            onPress={handleStart}
            disabled={questionCount === 0}
            style={styles.actionBtn}
          >
            Commencer
          </Button>
        </View>

        {/* Content Grid */}
        <View style={styles.grid}>
          {contents.map((item) => item && (
            <View key={item.id} style={styles.gridItem}>
              <ContentCard
                id={item.id}
                title={item.title}
                source={item.source}
                thumbnailUrl={item.thumbnailUrl}
                channelName={item.channelName}
                duration={item.duration}
                status={item.status}
                onPress={() => handleContentPress(item.id)}
              />
            </View>
          ))}
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
    padding: GRID_PADDING,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerName: {
    marginBottom: spacing.xs,
  },
  nameLoader: {
    marginBottom: spacing.sm,
  },
  description: {
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginTop: spacing.md,
  },
  gridItem: {
    width: COLUMN_WIDTH,
  },
});
