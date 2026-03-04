/**
 * LoadingScreen - Premium animated loading experience
 * Inspired by Brilliant's minimal, elegant loading states
 */

import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { colors } from '../theme';

// Animated ring component
function PulseRing({ delay = 0 }: { delay?: number }) {
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withTiming(1.2, { duration: 1800, easing: Easing.out(Easing.quad) }),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(0, { duration: 1800, easing: Easing.out(Easing.quad) }),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.ring, animatedStyle]} />;
}

export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Animated.View
        entering={FadeIn.duration(600)}
        style={styles.content}
      >
        {/* Minimal pulse ring */}
        <View style={styles.ringContainer}>
          <PulseRing />
          <PulseRing delay={500} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
  },
});
