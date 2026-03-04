/**
 * DailyProgressTracker - Minimal top bar with progress segments and streak counter
 * Matches Figma design: Ankora node 180:103
 */

import { View, StyleSheet } from 'react-native';
import { Flame } from 'lucide-react-native';
import { Text } from '../ui';
import { colors, spacing, fonts, typography } from '../../theme';

interface DailyProgressTrackerProps {
  completed: number;
  total: number;
  streak?: number;
}

export function DailyProgressTracker({ completed, total, streak = 0 }: DailyProgressTrackerProps) {
  const segments = Array.from({ length: total }, (_, i) => i < completed);

  return (
    <View style={styles.container}>
      {/* Progress bar - takes remaining space */}
      <View style={styles.progressBar}>
        {segments.map((isFilled, index) => (
          <View
            key={index}
            style={[
              styles.segment,
              isFilled ? styles.segmentFilled : styles.segmentEmpty,
            ]}
          />
        ))}
      </View>

      {/* Streak counter */}
      <View style={styles.streakContainer}>
        <Text style={styles.streakCount}>{streak}</Text>
        <Flame size={16} color={colors.warning} fill={colors.warning} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
    gap: spacing.xl + spacing.lg, // 48px gap as in Figma
  },
  progressBar: {
    flex: 1,
    flexDirection: 'row',
    height: spacing.xs,
    gap: spacing.xxs,
  },
  segment: {
    flex: 1,
    height: spacing.xs,
    borderRadius: 1,
  },
  segmentFilled: {
    backgroundColor: colors.successLight,
  },
  segmentEmpty: {
    backgroundColor: colors.lavender,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  streakCount: {
    ...typography.h4,
    fontFamily: fonts.semibold,
    color: colors.text,
    fontVariant: ['lining-nums', 'proportional-nums'],
  },
});
