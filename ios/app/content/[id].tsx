/**
 * Content Detail Screen - Shows content info, synopsis, quiz access
 */

import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Image, Pressable, Modal, FlatList } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Button } from '../../components/ui';
import { PlatformIcon } from '../../components/icons';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorState } from '../../components/ErrorState';
import Markdown from 'react-native-markdown-display';
import { useContent, useThemes, useAddContentToTheme, useRemoveContentFromTheme } from '../../hooks';
import { colors, spacing, borderRadius, fonts } from '../../theme';

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
  const { id, dailyRecId } = useLocalSearchParams<{ id: string; dailyRecId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: content, isLoading, error, refetch } = useContent(id!);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const { data: allThemes } = useThemes();
  const addContentToTheme = useAddContentToTheme();
  const removeContentFromTheme = useRemoveContentFromTheme();

  // Auto-refresh when content is processing
  useEffect(() => {
    if (!content) return;
    const isProcessing = ['SELECTED', 'TRANSCRIBING', 'GENERATING'].includes(content.status);
    if (!isProcessing) return;

    const interval = setInterval(() => { refetch(); }, 5000);
    return () => clearInterval(interval);
  }, [content?.status, refetch]);

  const headerOptions = { title: '', headerBackTitle: 'Retour', headerShadowVisible: false, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={headerOptions} />
        <LoadingScreen />
      </>
    );
  }

  if (error || !content) {
    return (
      <>
        <Stack.Screen options={headerOptions} />
        <ErrorState message="Contenu introuvable" onRetry={refetch} hasHeader />
      </>
    );
  }

  const handleStartQuiz = () => {
    router.push({ pathname: '/quiz/[id]' as any, params: { id: id!, dailyRecId: dailyRecId || '' } });
  };

  const hasQuiz = (content.quizCount ?? 0) > 0;
  const isPodcast = content.source === 'spotify';
  const displayText = content.synopsis || content.description;

  return (
    <>
      <Stack.Screen options={headerOptions} />
      <View style={styles.container}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Thumbnail */}
          <View style={[styles.thumbnailWrapper, isPodcast && styles.podcastThumbnailWrapper]}>
            {content.thumbnailUrl ? (
              <Image
                source={{ uri: content.thumbnailUrl }}
                style={[styles.thumbnail, isPodcast && styles.podcastThumbnail]}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailPlaceholder, isPodcast && styles.podcastThumbnail]}>
                <PlatformIcon platform={content.source} size={48} colored />
              </View>
            )}
            <View style={styles.sourceBadge}>
              <Text variant="label" style={styles.sourceBadgeText}>
                {sourceLabel[content.source] || content.source}
              </Text>
            </View>
          </View>

          {/* Title & Channel */}
          <Text variant="h1" style={styles.title}>
            {content.title}
          </Text>
          <View style={styles.channelRow}>
            {content.channelName && (
              <Text variant="body" color="secondary" numberOfLines={1} style={styles.channelName}>
                {content.channelName}
              </Text>
            )}
            {content.source === 'youtube' && content.duration && (
              <Text variant="caption" color="secondary">
                {formatDuration(content.duration)}
              </Text>
            )}
          </View>

          {/* Themes */}
          <View style={styles.section}>
            <Text variant="body" weight="medium" style={styles.sectionTitle}>
              Thèmes
            </Text>
            <View style={styles.themes}>
              {content.themes && content.themes.length > 0 ? (
                content.themes.map((theme) => (
                  <Pressable
                    key={theme.id}
                    onPress={() => router.push({ pathname: '/theme/[id]' as any, params: { id: theme.id } })}
                    style={styles.themeChip}
                  >
                    <Text variant="caption" style={styles.themeChipLabel}>{theme.emoji} {theme.name}</Text>
                  </Pressable>
                ))
              ) : (
                <Text variant="caption" color="secondary">
                  Aucun thème
                </Text>
              )}
              <Pressable onPress={() => setShowThemeModal(true)} style={styles.addThemeChip}>
                <Text variant="caption" color="secondary">+ Thème</Text>
              </Pressable>
            </View>
          </View>

          {/* Synopsis or Description */}
          {displayText && (
            <View style={styles.section}>
              <Text variant="body" weight="medium" style={styles.sectionTitle}>
                Description
              </Text>
              <Markdown style={markdownStyles}>
                {displayText}
              </Markdown>
            </View>
          )}
        </ScrollView>

        {/* Sticky bottom actions */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          {hasQuiz ? (
            <Button variant="primary" fullWidth onPress={handleStartQuiz}>
              Quiz ({content.quizCount} question{(content.quizCount ?? 0) !== 1 ? 's' : ''})
            </Button>
          ) : (
            <Button variant="primary" fullWidth disabled onPress={() => { }}>
              {content.status === 'TRANSCRIBING' ? 'Transcription en cours...' :
                content.status === 'GENERATING' ? 'Quiz en création...' :
                  content.status === 'FAILED' ? 'Erreur de traitement' :
                    content.status === 'UNSUPPORTED' ? 'Contenu non supporté' :
                      'En attente de traitement...'}
            </Button>
          )}
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
            <Text variant="h2">Gérer les thèmes</Text>
            <Pressable onPress={() => setShowThemeModal(false)} hitSlop={8}>
              <Text variant="body" color="secondary">Fermer</Text>
            </Pressable>
          </View>
          <FlatList
            data={allThemes ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalList}
            renderItem={({ item: theme }) => {
              const isAssigned = content.themes?.some((t) => t.id === theme.id) ?? false;
              return (
                <Pressable
                  onPress={async () => {
                    try {
                      if (isAssigned) {
                        await removeContentFromTheme.mutateAsync({ themeId: theme.id, contentId: id! });
                      } else {
                        await addContentToTheme.mutateAsync({ themeId: theme.id, contentIds: [id!] });
                      }
                      refetch();
                    } catch (error) {
                      console.error('Failed to toggle theme:', error);
                    }
                  }}
                  style={styles.modalItem}
                >
                  <Text style={styles.modalItemEmoji}>{theme.emoji}</Text>
                  <View style={styles.modalItemInfo}>
                    <Text variant="body" weight="medium">{theme.name}</Text>
                    <Text variant="caption" color="secondary">
                      {theme.contentCount} contenu{theme.contentCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={[styles.checkbox, isAssigned && styles.checkboxChecked]}>
                    {isAssigned && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text variant="body" color="secondary" style={styles.modalEmpty}>
                Aucun thème. Créez-en un d'abord.
              </Text>
            }
          />
        </View>
      </Modal>
    </>
  );
}

const markdownStyles = StyleSheet.create({
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  strong: {
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  em: {
    fontFamily: fonts.regular,
    fontStyle: 'italic',
  },
  heading1: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  heading2: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  heading3: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  bullet_list_icon: {
    color: colors.textSecondary,
  },
  ordered_list_icon: {
    color: colors.textSecondary,
  },
  list_item: {
    marginVertical: 2,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: spacing.sm,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 160 },
  thumbnailWrapper: {
    position: 'relative',
    marginBottom: spacing.lg,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: borderRadius.md,
  },
  thumbnailPlaceholder: {
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  podcastThumbnailWrapper: {
    alignSelf: 'center',
    width: '60%',
  },
  podcastThumbnail: {
    aspectRatio: 1,
    borderRadius: borderRadius.lg,
  },
  sourceBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  sourceBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Geist_500Medium',
  },
  title: { marginBottom: spacing.xs, flexShrink: 1 },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  channelName: { flex: 1 },
  section: { marginBottom: spacing.xl },
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  themeChipLabel: {
    color: colors.text,
    fontSize: 13,
  },
  addThemeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.xs,
    borderWidth: 2,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '700',
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
