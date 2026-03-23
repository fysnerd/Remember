/**
 * Quiz summary component
 */

import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy, ThumbsUp, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, Button } from '../ui';
import { colors, spacing } from '../../theme';

interface QuizSummaryProps {
  score: number;
  total: number;
  onViewMemo: () => void;
  onClose: () => void;
  memoLabel?: string; // Custom label for memo button (default: "Voir le memo")
  hideSecondButton?: boolean; // Hide the "Retour" button
}

export function QuizSummary({ score, total, onViewMemo, onClose, memoLabel, hideSecondButton = false }: QuizSummaryProps) {
  const { t } = useTranslation();
  const resolvedMemoLabel = memoLabel ?? t('content.viewMemo');
  const percentage = Math.round((score / total) * 100);
  const ResultIcon = percentage >= 80 ? Trophy : percentage >= 50 ? ThumbsUp : Star;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <ResultIcon size={64} color={colors.accent} strokeWidth={1.5} />

        <Text variant="h1" style={styles.score}>
          {t('quiz.scoreLabel', { score, total })}
        </Text>

        <Text variant="body" color="secondary" style={styles.message}>
          {t('quiz.summaryMessage', { count: score, total })}
        </Text>

        <View style={styles.actions}>
          <Button variant="primary" fullWidth onPress={onViewMemo}>
            {resolvedMemoLabel}
          </Button>
          {!hideSecondButton && (
            <Button variant="outline" fullWidth onPress={onClose}>
              {t('common.back')}
            </Button>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  score: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  message: {
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  actions: {
    width: '100%',
    gap: spacing.md,
  },
});
