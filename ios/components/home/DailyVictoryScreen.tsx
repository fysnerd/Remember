/**
 * DailyVictoryScreen - Shown on home when all daily quizzes are completed
 */

import { View, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '../ui';
import { colors, spacing, fonts, typography } from '../../theme';

interface DailyVictoryScreenProps {
  streak: number;
}

export function DailyVictoryScreen({ streak }: DailyVictoryScreenProps) {
  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.content}>
        <Text style={styles.trophy}>🏆</Text>
        <Text style={styles.title}>Bravo !</Text>
        <Text style={styles.subtitle}>Tes 3 quiz du jour sont termines</Text>
        {streak > 0 && (
          <Text style={styles.streak}>🔥 {streak} jour{streak > 1 ? 's' : ''} de suite</Text>
        )}
        <Text style={styles.hint}>Reviens demain pour de nouveaux quiz</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  content: {
    alignItems: 'center',
  },
  trophy: {
    fontSize: 72,
    lineHeight: 84,
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 38,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    ...typography.body,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  streak: {
    color: colors.accent,
    fontFamily: fonts.medium,
    ...typography.h4,
    marginBottom: spacing.lg,
  },
  hint: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    ...typography.caption,
    textAlign: 'center',
  },
});
