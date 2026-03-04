/**
 * Quiz answer feedback component
 * Full-screen tinted layout: subtle green/red background wash
 */

import { View, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { Text } from '../ui';
import { colors, spacing, borderRadius, feedback as themeFeedback, typography } from '../../theme';

interface AnswerFeedbackProps {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
}

const feedback = {
  correct: {
    iconBg: themeFeedback.correct.background,
    iconColor: colors.successLight,
    cardBorder: themeFeedback.correct.border,
    cardBg: themeFeedback.correct.background,
  },
  wrong: {
    iconBg: themeFeedback.incorrect.background,
    iconColor: colors.error,
    cardBorder: themeFeedback.incorrect.border,
    cardBg: themeFeedback.incorrect.background,
  },
};

export function AnswerFeedback({
  isCorrect,
  correctAnswer,
  explanation,
}: AnswerFeedbackProps) {
  const theme = isCorrect ? feedback.correct : feedback.wrong;

  return (
    <View style={styles.container}>
      <View style={styles.resultRow}>
        <View style={[styles.iconCircle, { backgroundColor: theme.iconBg }]}>
          {isCorrect ? (
            <Check size={28} color={theme.iconColor} strokeWidth={2.5} />
          ) : (
            <X size={28} color={theme.iconColor} strokeWidth={2.5} />
          )}
        </View>
        <Text variant="h2" style={{ color: theme.iconColor }}>
          {isCorrect ? 'Correct !' : 'Incorrect'}
        </Text>
      </View>

      <View>
        <Text variant="caption" color="secondary" style={styles.label}>
          Bonne réponse
        </Text>
        <Text variant="body" weight="medium" style={styles.answer}>
          {correctAnswer}
        </Text>

        <Text variant="caption" color="secondary" style={styles.label}>
          Explication
        </Text>
        <Text variant="body" color="secondary">
          {explanation}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.xl,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  label: {
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    ...typography.labelSmall,
  },
  answer: {
    marginBottom: spacing.lg,
  },
  divider: {
    height: 1,
    marginBottom: spacing.lg,
  },
});
