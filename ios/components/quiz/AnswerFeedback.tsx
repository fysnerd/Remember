/**
 * Quiz answer feedback component
 * Full-screen tinted layout: subtle green/red background wash
 */

import { View, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { Text } from '../ui';
import { colors, spacing, borderRadius } from '../../theme';

interface AnswerFeedbackProps {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
}

const feedback = {
  correct: {
    iconBg: 'rgba(34, 197, 94, 0.15)',
    iconColor: '#4ADE80',
    cardBorder: 'rgba(34, 197, 94, 0.2)',
    cardBg: 'rgba(34, 197, 94, 0.06)',
  },
  wrong: {
    iconBg: 'rgba(239, 68, 68, 0.15)',
    iconColor: '#F87171',
    cardBorder: 'rgba(239, 68, 68, 0.2)',
    cardBg: 'rgba(239, 68, 68, 0.06)',
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
    fontSize: 11,
  },
  answer: {
    marginBottom: spacing.lg,
  },
  divider: {
    height: 1,
    marginBottom: spacing.lg,
  },
});
