/**
 * Quiz answer feedback component
 */

import { View, StyleSheet } from 'react-native';
import { Text } from '../ui';
import { colors, spacing, borderRadius } from '../../theme';

interface AnswerFeedbackProps {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
}

export function AnswerFeedback({
  isCorrect,
  correctAnswer,
  explanation,
}: AnswerFeedbackProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.header, isCorrect ? styles.correct : styles.wrong]}>
        <Text variant="h2" color="inverse">
          {isCorrect ? '✓ Correct !' : '✗ Incorrect'}
        </Text>
      </View>

      <View style={styles.content}>
        <Text variant="body" color="secondary" style={styles.label}>
          La bonne réponse était :
        </Text>
        <Text variant="body" weight="medium" style={styles.answer}>
          {correctAnswer}
        </Text>

        <Text variant="body" color="secondary" style={styles.label}>
          Explication :
        </Text>
        <Text variant="body">{explanation}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  header: {
    padding: spacing.md,
    alignItems: 'center',
  },
  correct: {
    backgroundColor: colors.success,
  },
  wrong: {
    backgroundColor: colors.error,
  },
  content: {
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  label: {
    marginBottom: spacing.xs,
  },
  answer: {
    marginBottom: spacing.md,
  },
});
