/**
 * Onboarding Splash Screen
 *
 * Step 0: Animated "ANKORA" logo with fade-in + scale.
 * Auto-navigates to the name screen after 2.5 seconds.
 */

import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../../theme';

export default function OnboardingSplash() {
  const router = useRouter();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);

  useEffect(() => {
    // Start entrance animation
    opacity.value = withTiming(1, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
    scale.value = withTiming(1, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });

    // Navigate after 2.5 seconds
    const timer = setTimeout(() => {
      router.replace('/onboarding/name' as any);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.logo, animatedStyle]}>
        ANKORA
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontFamily: fonts.bold,
    fontSize: 42,
    letterSpacing: 8,
    color: colors.accent,
  },
});
