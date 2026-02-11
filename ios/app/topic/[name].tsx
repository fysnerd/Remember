/**
 * Topic Screen - Shows content filtered by topic
 */

import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Inbox, Settings } from 'lucide-react-native';
import { Text, Card, Button } from '../../components/ui';
import { PlatformIcon } from '../../components/icons';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';
import { useContentList } from '../../hooks';
import { colors, spacing } from '../../theme';

export default function TopicScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const decodedName = decodeURIComponent(name || '');
  const { data: contentData, isLoading } = useContentList({ topic: decodedName });

  const handleContentPress = (id: string) => {
    router.push({ pathname: '/content/[id]', params: { id } });
  };

  const handleStartQuiz = () => {
    router.push({ pathname: '/quiz/topic/[name]', params: { name: encodeURIComponent(decodedName) } });
  };

  const handleManageTopic = () => {
    router.push({ pathname: '/topic/manage/[name]', params: { name: encodeURIComponent(decodedName) } });
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  const items = contentData?.items ?? [];

  return (
    <>
      <Stack.Screen
        options={{
          title: decodedName,
          headerBackTitle: 'Retour',
          headerRight: () => (
            <Pressable onPress={handleManageTopic} hitSlop={8} style={styles.settingsButton}>
              <Settings size={20} color={colors.text} strokeWidth={1.75} />
            </Pressable>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {items.length === 0 ? (
          <EmptyState message={'Aucun contenu pour "' + decodedName + '"'} icon={Inbox} hasHeader />
        ) : (
          <>
            <View style={styles.list}>
              {items.map((item) => (
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
                      {item.duration && (
                        <Text variant="caption" color="secondary">
                          {item.duration}
                        </Text>
                      )}
                    </View>
                  </View>
                </Card>
              ))}
            </View>

            {/* Quiz button */}
            <View style={styles.quizButton}>
              <Button variant="primary" fullWidth onPress={handleStartQuiz}>
                Quiz {decodedName}
              </Button>
            </View>
          </>
        )}
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
  settingsButton: {
    paddingHorizontal: spacing.sm,
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
  quizButton: {
    marginTop: spacing.xl,
  },
});
