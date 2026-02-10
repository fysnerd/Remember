/**
 * Content Detail Screen
 */

import { useState } from 'react';
import { View, ScrollView, StyleSheet, Image, Linking, Pressable, Modal, FlatList } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Button, TopicChip } from '../../components/ui';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorState } from '../../components/ErrorState';
import { TopicEditModal } from '../../components/TopicEditModal';
import { useContent, useUpdateContentTopics, useThemes, useAddContentToTheme } from '../../hooks';
import { colors, spacing, borderRadius } from '../../theme';

const sourceEmoji: Record<string, string> = {
  youtube: '🎬',
  spotify: '🎧',
  tiktok: '📱',
  instagram: '📷',
};

const sourceLabel: Record<string, string> = {
  youtube: 'YouTube',
  spotify: 'Spotify',
  tiktok: 'TikTok',
  instagram: 'Instagram',
};

// Format duration in seconds to mm:ss or hh:mm:ss
function formatDuration(seconds?: number): string | null {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ContentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: content, isLoading, error, refetch } = useContent(id!);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const updateTopics = useUpdateContentTopics();
  const { data: allThemes } = useThemes();
  const addContentToTheme = useAddContentToTheme();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !content) {
    return <ErrorState message="Contenu introuvable" onRetry={refetch} hasHeader />;
  }

  const handleStartQuiz = () => {
    router.push(`/quiz/${id}`);
  };

  const handleViewMemo = () => {
    router.push(`/memo/${id}`);
  };

  const handleOpenSource = () => {
    if (content.url) {
      Linking.openURL(content.url);
    }
  };

  const handleRemoveTopic = async (topicToRemove: string) => {
    const newTopics = content.topics.filter((t) => t !== topicToRemove);
    try {
      await updateTopics.mutateAsync({ contentId: id!, tags: newTopics });
    } catch (error) {
      console.error('Failed to remove topic:', error);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: '', headerBackTitle: 'Retour' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Thumbnail */}
        {content.thumbnailUrl ? (
          <Image
            source={{ uri: content.thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Text variant="h1" style={styles.thumbnailEmoji}>
              {sourceEmoji[content.source] || '📄'}
            </Text>
          </View>
        )}

        {/* Title & Channel */}
        <Text variant="h1" style={styles.title}>
          {content.title}
        </Text>
        {content.channelName && (
          <Text variant="body" color="secondary" style={styles.channelName}>
            {content.channelName}
          </Text>
        )}
        <View style={styles.metaRow}>
          <Text variant="caption" color="secondary">
            {sourceEmoji[content.source]} {sourceLabel[content.source] || content.source}
            {content.duration && ` • ${formatDuration(content.duration)}`}
          </Text>
          {content.url && (
            <Pressable onPress={handleOpenSource} style={styles.sourceLink}>
              <Text variant="caption" style={styles.sourceLinkText}>
                Voir l'original →
              </Text>
            </Pressable>
          )}
        </View>

        {/* Topics */}
        <View style={styles.section}>
          <Text variant="body" weight="medium" style={styles.sectionTitle}>
            Topics
          </Text>
          <View style={styles.topics}>
            {content.topics && content.topics.length > 0 ? (
              content.topics.map((topic) => (
                <TopicChip
                  key={topic}
                  label={topic}
                  onRemove={() => handleRemoveTopic(topic)}
                />
              ))
            ) : (
              <Text variant="caption" color="secondary">
                Aucun topic
              </Text>
            )}
            <TopicChip label="+" onPress={() => setShowTopicModal(true)} />
          </View>
        </View>

        {/* Themes */}
        <View style={styles.section}>
          <Text variant="body" weight="medium" style={styles.sectionTitle}>
            Themes
          </Text>
          <View style={styles.topics}>
            {content.themes && content.themes.length > 0 ? (
              content.themes.map((theme) => (
                <Pressable
                  key={theme.id}
                  onPress={() => router.push({ pathname: '/theme/[id]' as any, params: { id: theme.id } })}
                  style={[styles.themeChip, { borderColor: theme.color }]}
                >
                  <Text variant="caption">{theme.emoji} {theme.name}</Text>
                </Pressable>
              ))
            ) : (
              <Text variant="caption" color="secondary">
                Aucun theme
              </Text>
            )}
            <Pressable onPress={() => setShowThemeModal(true)} style={styles.addThemeChip}>
              <Text variant="caption" color="secondary">+ Theme</Text>
            </Pressable>
          </View>
        </View>

        {/* Description */}
        {content.description && (
          <View style={styles.section}>
            <Text variant="body" color="secondary" numberOfLines={4}>
              {content.description}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button variant="primary" fullWidth onPress={handleStartQuiz}>
            Faire le quiz
          </Button>
          <Button variant="outline" fullWidth onPress={handleViewMemo}>
            Voir le mémo
          </Button>
        </View>
      </ScrollView>

      {/* Topic Edit Modal */}
      <TopicEditModal
        visible={showTopicModal}
        onClose={() => setShowTopicModal(false)}
        contentId={id!}
        currentTopics={content.topics || []}
      />

      {/* Add to Theme Modal */}
      <Modal
        visible={showThemeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text variant="h2">Ajouter a un theme</Text>
            <Pressable onPress={() => setShowThemeModal(false)} hitSlop={8}>
              <Text variant="body" color="secondary">Fermer</Text>
            </Pressable>
          </View>
          <FlatList
            data={allThemes ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalList}
            renderItem={({ item: theme }) => {
              const alreadyAssigned = content.themes?.some((t) => t.id === theme.id) ?? false;
              return (
                <Pressable
                  onPress={async () => {
                    if (alreadyAssigned) return;
                    try {
                      await addContentToTheme.mutateAsync({ themeId: theme.id, contentIds: [id!] });
                      setShowThemeModal(false);
                    } catch (error) {
                      console.error('Failed to add content to theme:', error);
                    }
                  }}
                  style={[styles.modalItem, alreadyAssigned && styles.modalItemDimmed]}
                  disabled={alreadyAssigned}
                >
                  <Text style={styles.modalItemEmoji}>{theme.emoji}</Text>
                  <View style={styles.modalItemInfo}>
                    <Text variant="body" weight="medium">{theme.name}</Text>
                    <Text variant="caption" color="secondary">
                      {theme.contentCount} contenu{theme.contentCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {alreadyAssigned && (
                    <Text variant="caption" color="secondary">Deja ajouté</Text>
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text variant="body" color="secondary" style={styles.modalEmpty}>
                Aucun theme. Creez-en un d'abord.
              </Text>
            }
            ListFooterComponent={
              <Pressable
                onPress={() => {
                  setShowThemeModal(false);
                  router.push('/theme-create' as any);
                }}
                style={styles.modalCreateLink}
              >
                <Text variant="body" style={styles.modalCreateLinkText}>
                  + Creer un theme
                </Text>
              </Pressable>
            }
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
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
  thumbnailEmoji: { fontSize: 48 },
  title: { marginBottom: spacing.xs },
  channelName: { marginBottom: spacing.sm },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  sourceLink: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  sourceLinkText: {
    color: colors.text,
    textDecorationLine: 'underline',
  },
  section: { marginBottom: spacing.lg },
  sectionTitle: { marginBottom: spacing.sm },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { gap: spacing.md, marginTop: spacing.lg },
  themeChip: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  addThemeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderStyle: 'dashed',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalList: {
    padding: spacing.lg,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalItemDimmed: {
    opacity: 0.4,
  },
  modalItemEmoji: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  modalItemInfo: {
    flex: 1,
  },
  modalEmpty: {
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  modalCreateLink: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  modalCreateLinkText: {
    color: colors.accent,
    textDecorationLine: 'underline',
  },
});
