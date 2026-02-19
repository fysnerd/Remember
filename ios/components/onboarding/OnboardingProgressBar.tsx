/**
 * Animated progress bar for onboarding flow
 */

import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, borderRadius } from '../../theme';

interface OnboardingProgressBarProps {
  /** Current step (1-10) */
  step: number;
  /** Total steps */
  total?: number;
}

export function OnboardingProgressBar({ step, total = 10 }: OnboardingProgressBarProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(step / total, {
      duration: 400,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [step, total]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, animatedStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
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
