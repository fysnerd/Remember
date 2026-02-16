/**
 * Content Detail Screen - Shows content info, synopsis, quiz access
 */

import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Image, Linking, Pressable, Modal, FlatList } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Button } from '../../components/ui';
import { PlatformIcon } from '../../components/icons';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorState } from '../../components/ErrorState';
import { useContent, useThemes, useAddContentToTheme } from '../../hooks';
import { colors, spacing, borderRadius } from '../../theme';

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
  const insets = useSafeAreaInsets();
  const { data: content, isLoading, error, refetch } = useContent(id!);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const { data: allThemes } = useThemes();
  const addContentToTheme = useAddContentToTheme();

  // Auto-refresh when content is processing
  useEffect(() => {
    if (!content) return;
    const isProcessing = ['SELECTED', 'TRANSCRIBING', 'GENERATING'].includes(content.status);
    if (!isProcessing) return;

    const interval = setInterval(() => { refetch(); }, 5000);
    return () => clearInterval(interval);
  }, [content?.status, refetch]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !content) {
    return <ErrorState message="Contenu introuvable" onRetry={refetch} hasHeader />;
  }

  const handleStartQuiz = () => {
    router.push({ pathname: '/quiz/[id]' as any, params: { id: id! } });
  };

  const handleViewMemo = () => {
    router.push(`/memo/${id}`);
  };

  const handleOpenSource = () => {
    if (content.url) {
      Linking.openURL(content.url);
    }
  };

  const hasQuiz = (content.quizCount ?? 0) > 0;
  const displayText = content.synopsis || content.description;

  return (
    <>
      <Stack.Screen options={{ title: '', headerBackTitle: 'Retour' }} />
      <View style={styles.container}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Thumbnail */}
          {content.thumbnailUrl ? (
            <Image
              source={{ uri: content.thumbnailUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
              <PlatformIcon platform={content.source} size={48} colored />
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
            <View style={styles.metaSource}>
              <PlatformIcon platform={content.source} size={14} colored />
              <Text variant="caption" color="secondary">
                {sourceLabel[content.source] || content.source}
                {content.duration && ` \u2022 ${formatDuration(content.duration)}`}
              </Text>
            </View>
            {content.url && (
              <Pressable onPress={handleOpenSource} style={styles.sourceLink}>
                <Text variant="caption" style={styles.sourceLinkText}>
                  Voir l'original →
                </Text>
              </Pressable>
            )}
          </View>

          {/* Quiz badge */}
          {hasQuiz && (
            <View style={styles.quizBadge}>
              <Text variant="body" weight="medium">
                {content.quizCount} question{(content.quizCount ?? 0) !== 1 ? 's' : ''} disponibles
              </Text>
            </View>
          )}

          {/* Themes */}
          <View style={styles.section}>
            <Text variant="body" weight="medium" style={styles.sectionTitle}>
              Themes
            </Text>
            <View style={styles.themes}>
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

          {/* Synopsis or Description */}
          {displayText && (
            <View style={styles.section}>
              <Text variant="body" color="secondary" numberOfLines={3}>
                {displayText}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Sticky bottom actions */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          {hasQuiz ? (
            <Button variant="primary" fullWidth onPress={handleStartQuiz}>
              Faire le quiz
            </Button>
          ) : (
            <Button variant="primary" fullWidth disabled onPress={() => {}}>
              {content.status === 'TRANSCRIBING' ? 'Transcription en cours...' :
               content.status === 'GENERATING' ? 'Quiz en creation...' :
               content.status === 'FAILED' ? 'Erreur de traitement' :
               content.status === 'UNSUPPORTED' ? 'Contenu non supporte' :
               'En attente de traitement...'}
            </Button>
          )}
          <Button variant="outline" fullWidth onPress={handleViewMemo}>
            Voir le memo
          </Button>
        </View>
      </View>

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
                    <Text variant="caption" color="secondary">Deja ajoute</Text>
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text variant="body" color="secondary" style={styles.modalEmpty}>
                Aucun theme. Creez-en un d'abord.
              </Text>
            }
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 160 },
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
  title: { marginBottom: spacing.xs },
  channelName: { marginBottom: spacing.sm },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  metaSource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sourceLink: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  sourceLinkText: {
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  quizBadge: {
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  section: { marginBottom: spacing.lg },
  sectionTitle: { marginBottom: spacing.sm },
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
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
});
