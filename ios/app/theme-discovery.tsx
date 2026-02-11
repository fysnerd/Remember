/**
 * Theme Discovery Screen - Review, rename, merge, or dismiss pending themes
 *
 * Users see AI-generated themes and can curate them before they appear
 * in the main navigation. Actions are sent as a bulk request.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  Modal,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Button } from '../components/ui';
import { DiscoveryThemeCard } from '../components/DiscoveryThemeCard';
import { usePendingThemes, useDiscoverThemes } from '../hooks';
import { LoadingScreen } from '../components/LoadingScreen';
import { DiscoverAction, ThemeListItem } from '../types/content';
import { colors, spacing, borderRadius } from '../theme';

export default function ThemeDiscoveryScreen() {
  const router = useRouter();
  const { data: pendingThemes, isLoading } = usePendingThemes();
  const discoverMutation = useDiscoverThemes();

  // Local editing state
  const [editedNames, setEditedNames] = useState<Map<string, string>>(new Map());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [merges, setMerges] = useState<Map<string, string>>(new Map());
  const [mergePickerSourceId, setMergePickerSourceId] = useState<string | null>(null);

  // Navigate back if no pending themes
  useEffect(() => {
    if (!isLoading && (!pendingThemes || pendingThemes.length === 0)) {
      router.back();
    }
  }, [isLoading, pendingThemes]);

  // Visible themes = not dismissed and not merged away
  const visibleThemes = useMemo(() => {
    if (!pendingThemes) return [];
    return pendingThemes.filter(
      (t) => !dismissedIds.has(t.id) && !merges.has(t.id)
    );
  }, [pendingThemes, dismissedIds, merges]);

  const handleRename = useCallback((id: string, newName: string) => {
    setEditedNames((prev) => new Map(prev).set(id, newName));
  }, []);

  const handleMerge = useCallback((sourceId: string) => {
    setMergePickerSourceId(sourceId);
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  }, []);

  const handlePickMergeTarget = useCallback(
    (targetId: string) => {
      if (mergePickerSourceId) {
        setMerges((prev) => new Map(prev).set(mergePickerSourceId, targetId));
        setMergePickerSourceId(null);
      }
    },
    [mergePickerSourceId]
  );

  const handleConfirm = async () => {
    if (!pendingThemes) return;

    const actions: DiscoverAction[] = [];

    // Dismissed themes
    for (const themeId of dismissedIds) {
      actions.push({ type: 'dismiss', themeId });
    }

    // Merged themes
    for (const [sourceThemeId, targetThemeId] of merges) {
      actions.push({ type: 'merge', sourceThemeId, targetThemeId });
    }

    // Remaining visible themes: confirm or rename
    for (const theme of visibleThemes) {
      const newName = editedNames.get(theme.id);
      if (newName && newName !== theme.name) {
        actions.push({ type: 'rename', themeId: theme.id, newName });
      } else {
        actions.push({ type: 'confirm', themeId: theme.id });
      }
    }

    try {
      await discoverMutation.mutateAsync(actions);
      router.replace('/(tabs)');
    } catch {
      // Error is available via discoverMutation.error
    }
  };

  // Merge target options = visible themes minus the source
  const mergeTargets = useMemo(() => {
    if (!mergePickerSourceId) return [];
    return visibleThemes.filter((t) => t.id !== mergePickerSourceId);
  }, [visibleThemes, mergePickerSourceId]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="h2" weight="bold">
            Vos themes
          </Text>
          <Text variant="body" color="secondary" style={styles.subtitle}>
            L'IA a identifie ces themes dans votre contenu. Renommez, fusionnez
            ou supprimez avant de confirmer.
          </Text>
        </View>

        {/* Theme cards */}
        {visibleThemes.map((theme) => (
          <DiscoveryThemeCard
            key={theme.id}
            id={theme.id}
            name={editedNames.get(theme.id) ?? theme.name}
            emoji={theme.emoji}
            color={theme.color}
            contentCount={theme.contentCount}
            onRename={handleRename}
            onMerge={handleMerge}
            onDismiss={handleDismiss}
          />
        ))}

        {visibleThemes.length === 0 && (
          <View style={styles.emptyState}>
            <Text variant="body" color="secondary">
              Tous les themes ont ete supprimes. Ajoutez du contenu pour generer
              de nouveaux themes.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          variant="primary"
          onPress={handleConfirm}
          disabled={discoverMutation.isPending || visibleThemes.length === 0}
        >
          {discoverMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            'Confirmer'
          )}
        </Button>
        {discoverMutation.isError && (
          <Text variant="caption" style={styles.errorText}>
            Une erreur est survenue. Reessayez.
          </Text>
        )}
      </View>

      {/* Merge picker modal */}
      <Modal
        visible={mergePickerSourceId !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMergePickerSourceId(null)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text variant="h3" weight="bold">
              Fusionner avec...
            </Text>
            <Pressable onPress={() => setMergePickerSourceId(null)}>
              <Text variant="body" color="secondary">
                Annuler
              </Text>
            </Pressable>
          </View>
          <FlatList
            data={mergeTargets}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalList}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handlePickMergeTarget(item.id)}
                style={({ pressed }) => [
                  styles.mergeTargetRow,
                  pressed && styles.mergeTargetPressed,
                ]}
              >
                <Text style={styles.mergeTargetEmoji}>{item.emoji}</Text>
                <View style={styles.mergeTargetInfo}>
                  <Text variant="body" weight="medium">
                    {editedNames.get(item.id) ?? item.name}
                  </Text>
                  <Text variant="caption" color="secondary">
                    {item.contentCount} contenu{item.contentCount !== 1 ? 's' : ''}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  subtitle: {
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  emptyState: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  // Modal styles
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
    borderBottomColor: colors.borderLight,
  },
  modalList: {
    padding: spacing.lg,
  },
  mergeTargetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mergeTargetPressed: {
    opacity: 0.6,
  },
  mergeTargetEmoji: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  mergeTargetInfo: {
    flex: 1,
  },
});
