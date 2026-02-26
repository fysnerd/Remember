/**
 * Quiz summary component
 */

import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy, ThumbsUp, Star } from 'lucide-react-native';
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

export function QuizSummary({ score, total, onViewMemo, onClose, memoLabel = 'Voir le mémo', hideSecondButton = false }: QuizSummaryProps) {
  const percentage = Math.round((score / total) * 100);
  const ResultIcon = percentage >= 80 ? Trophy : percentage >= 50 ? ThumbsUp : Star;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <ResultIcon size={64} color={colors.accent} strokeWidth={1.5} />

        <Text variant="h1" style={styles.score}>
          Score : {score}/{total}
        </Text>

        <Text variant="body" color="secondary" style={styles.message}>
          Tu as bien répondu à {score} question{score > 1 ? 's' : ''} sur {total}.
        </Text>

        <View style={styles.actions}>
          <Button variant="primary" fullWidth onPress={onViewMemo}>
            {memoLabel}
          </Button>
          {!hideSecondButton && (
            <Button variant="outline" fullWidth onPress={onClose}>
              Retour
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
