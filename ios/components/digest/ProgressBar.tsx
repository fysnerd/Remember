/**
 * Animated progress bar showing current question position within a digest session.
 *
 * Uses react-native-reanimated for smooth width animation.
 */

import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Text } from '../ui';
import { colors, spacing, borderRadius } from '../../theme';

interface ProgressBarProps {
  /** 0-indexed current question */
  current: number;
  /** Total number of questions */
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const progress = total > 0 ? (current + 1) / total : 0;

  const animatedFillStyle = useAnimatedStyle(() => ({
    width: withTiming(`${Math.round(progress * 100)}%`, { duration: 300 }),
  }));

  return (
    <View style={styles.container}>
      <Text variant="body" weight="medium" color="secondary" style={styles.label}>
        Question {current + 1}/{total}
      </Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, animatedFillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
  },
  track: {
    height: 4,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
  },
});
