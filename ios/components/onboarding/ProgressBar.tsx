/**
 * Onboarding progress bar
 *
 * Thin animated bar at the top of each onboarding screen.
 * Uses react-native-reanimated for smooth width transitions.
 */

import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, borderRadius } from '../../theme';

interface ProgressBarProps {
  /** Progress value between 0 and 1 */
  progress: number;
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const clampedProgress = Math.min(1, Math.max(0, progress));

  const animatedFillStyle = useAnimatedStyle(() => ({
    width: withTiming(`${Math.round(clampedProgress * 100)}%`, { duration: 350 }),
  }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, animatedFillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    backgroundColor: colors.border,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
  },
});
