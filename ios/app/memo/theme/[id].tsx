/**
 * Theme Memo Screen - Aggregated synthesis memo from all contents of a theme
 */

import { View, ScrollView, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import { Text, Button } from '../../../components/ui';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ErrorState } from '../../../components/ErrorState';
import { useThemeMemo } from '../../../hooks';
import { colors, spacing, borderRadius, fonts } from '../../../theme';

const markdownStyles = {
  body: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 26,
  },
  heading1: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  heading2: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 18,
    lineHeight: 24,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  heading3: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 22,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  paragraph: {
    marginBottom: spacing.md,
    lineHeight: 26,
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
  strong: {
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  em: {
    fontStyle: 'italic' as const,
  },
  blockquote: {
    backgroundColor: colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    paddingLeft: spacing.md,
    paddingVertical: spacing.sm,
    marginVertical: spacing.md,
    borderRadius: borderRadius.sm,
  },
};

export default function ThemeMemoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: memo, isLoading, error, refetch } = useThemeMemo(id!);

  const handleDone = () => {
    router.back();
  };

  const headerOptions = { title: '', headerBackTitle: 'Retour', headerShadowVisible: false, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text };

  if (isLoading) {
    return (<><Stack.Screen options={headerOptions} /><LoadingScreen /></>);
  }

  if (error || !memo) {
    return (<><Stack.Screen options={headerOptions} /><ErrorState message="Mémo introuvable ou aucun contenu disponible" onRetry={refetch} hasHeader /></>);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: memo.themeName,
          headerBackTitle: 'Retour',
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}
      >
        {/* Header */}
        <Text variant="caption" color="secondary" style={styles.label}>
          MEMO {'\u2022'} {memo.contentCount} contenu{memo.contentCount > 1 ? 's' : ''}
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
            Retour au thème
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
  doneButton: { marginTop: spacing.lg },
});
