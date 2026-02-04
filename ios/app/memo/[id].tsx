/**
 * Memo Screen - Displays AI-generated memo in markdown
 */

import { View, ScrollView, StyleSheet, Pressable, Share } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import { Text, Button, useToast } from '../../components/ui';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorState } from '../../components/ErrorState';
import { useMemo } from '../../hooks';
import { colors, spacing, borderRadius } from '../../theme';

// Markdown styles
const markdownStyles = {
  body: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  heading1: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700' as const,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  heading2: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '600' as const,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  heading3: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600' as const,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  paragraph: {
    marginBottom: spacing.md,
    lineHeight: 24,
  },
  bullet_list: {
    marginBottom: spacing.md,
  },
  ordered_list: {
    marginBottom: spacing.md,
  },
  list_item: {
    marginBottom: spacing.xs,
  },
  bullet_list_icon: {
    marginRight: spacing.sm,
  },
  strong: {
    fontWeight: '600' as const,
  },
  em: {
    fontStyle: 'italic' as const,
  },
  blockquote: {
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
    borderLeftColor: colors.border,
    paddingLeft: spacing.md,
    paddingVertical: spacing.sm,
    marginVertical: spacing.md,
  },
  code_inline: {
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  fence: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: spacing.md,
  },
};

export default function MemoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: memo, isLoading, error, refetch } = useMemo(id!);
  const { show, ToastComponent } = useToast();

  const handleDone = () => {
    router.replace('/(tabs)');
  };

  const handleShare = async () => {
    if (!memo) return;

    try {
      await Share.share({
        message: memo.content,
        title: 'Mémo Remember',
      });
    } catch (error) {
      show('Erreur lors du partage', 'error');
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !memo) {
    return <ErrorState message="Mémo introuvable" onRetry={refetch} hasHeader />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerBackTitle: 'Retour',
          headerRight: () => (
            <Pressable
              onPress={handleShare}
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.surface,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text variant="body" style={{ textAlign: 'center' }}>📤</Text>
            </Pressable>
          ),
        }}
      />
      <ToastComponent />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}
      >
        {/* Header */}
        <Text variant="caption" color="secondary" style={styles.label}>
          MÉMO
        </Text>

        {/* Markdown Content */}
        <Markdown style={markdownStyles}>{memo.content}</Markdown>

        {/* Footer */}
        {memo.generatedAt && (
          <View style={styles.footer}>
            <Text variant="caption" color="secondary">
              Généré le {new Date(memo.generatedAt).toLocaleDateString('fr-FR')}
            </Text>
          </View>
        )}

        {/* Done button */}
        <View style={styles.doneButton}>
          <Button variant="primary" fullWidth onPress={handleDone}>
            OK
          </Button>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  label: { marginBottom: spacing.md, letterSpacing: 1 },
  footer: { alignItems: 'center', paddingTop: spacing.xl, marginTop: spacing.lg },
  doneButton: { marginTop: spacing.xl },
});
