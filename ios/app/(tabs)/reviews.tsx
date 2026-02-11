/**
 * Reviews Tab - Mémos (only shows content/topics that have been quizzed)
 */

import { View, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BookOpen, FileText } from 'lucide-react-native';
import { Text, Card } from '../../components/ui';
import { PlatformIcon } from '../../components/icons';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { useCompletedItems } from '../../hooks';
import { colors, spacing } from '../../theme';

export default function ReviewsScreen() {
  const router = useRouter();
  const { data, isLoading } = useCompletedItems();

  if (isLoading) {
    return <LoadingScreen />;
  }

  const contents = data?.items ?? [];
  const topics = data?.topics ?? [];

  // Combine into unified list: topics first, then contents
  const hasItems = contents.length > 0 || topics.length > 0;

  if (!hasItems) {
    return (
      <EmptyState
        message="Aucun mémo disponible. Faites un quiz pour débloquer les mémos !"
        icon={FileText}
        hasHeader
      />
    );
  }

  const handleContentMemo = (contentId: string) => {
    router.push(`/memo/${contentId}`);
  };

  const handleTopicMemo = (topicName: string) => {
    router.push({ pathname: '/memo/topic/[name]', params: { name: encodeURIComponent(topicName) } });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.list}>
        {/* Topics */}
        {topics.map((topic) => (
          <Card
            key={topic.id}
            padding="md"
            onPress={() => handleTopicMemo(topic.name)}
            style={styles.card}
          >
            <View style={styles.row}>
              <View style={styles.iconContainer}>
                <BookOpen size={20} color={colors.textSecondary} strokeWidth={1.75} />
              </View>
              <View style={styles.info}>
                <Text variant="body" weight="medium">
                  {topic.name}
                </Text>
                <Text variant="caption" color="secondary">
                  {topic.contentCount} contenu{topic.contentCount > 1 ? 's' : ''} • Thème
                </Text>
              </View>
            </View>
          </Card>
        ))}

        {/* Contents */}
        {contents.map((content) => (
          <Card
            key={content.id}
            padding="md"
            onPress={() => handleContentMemo(content.contentId)}
            style={styles.card}
          >
            <View style={styles.row}>
              <View style={styles.iconContainer}>
                <PlatformIcon platform={content.source} size={20} colored />
              </View>
              <View style={styles.info}>
                <Text variant="body" weight="medium" numberOfLines={2}>
                  {content.contentTitle}
                </Text>
                <Text variant="caption" color="secondary">
                  Voir le mémo
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
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
});
