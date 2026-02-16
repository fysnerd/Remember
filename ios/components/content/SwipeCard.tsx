/**
 * SwipeCard - Pan gesture-driven swipeable card with spring animations
 *
 * Provides:
 * - Gesture.Pan() for horizontal swiping with dampened vertical movement
 * - Spring fly-off animation when swipe threshold or velocity exceeded
 * - Bouncy snap-back when partial swipe below threshold
 * - Haptic feedback at threshold crossing and on swipe completion
 * - Rotation based on swipe direction for natural card feel
 * - SwipeOverlay rendered inside for keep/dismiss visual indicators
 */

import React, { useRef, useCallback } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { SwipeOverlay } from './SwipeOverlay';
import { haptics } from '../../lib/haptics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35; // 35% of screen
const VELOCITY_THRESHOLD = 500; // px/s fast flick

// Fast fly-off: high stiffness, heavy damping, no bounce
const FLY_OFF_SPRING = { stiffness: 900, damping: 120, mass: 4 };
// Bouncy snap-back: low damping for satisfying bounce
const SNAP_BACK_SPRING = { damping: 15, stiffness: 150, mass: 1 };

interface SwipeCardProps {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  children: React.ReactNode;
  enabled?: boolean;
}

export function SwipeCard({
  onSwipeLeft,
  onSwipeRight,
  children,
  enabled = true,
}: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const hasTriggeredHaptic = useRef(false);

  const triggerThresholdHaptic = useCallback(() => {
    haptics.medium();
  }, []);

  const triggerSuccessHaptic = useCallback(() => {
    haptics.success();
  }, []);

  const triggerWarningHaptic = useCallback(() => {
    haptics.warning();
  }, []);

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.3; // Dampen vertical

      // Fire haptic once when crossing threshold during drag
      if (
        Math.abs(event.translationX) > SWIPE_THRESHOLD &&
        !hasTriggeredHaptic.current
      ) {
        hasTriggeredHaptic.current = true;
        runOnJS(triggerThresholdHaptic)();
      } else if (
        Math.abs(event.translationX) <= SWIPE_THRESHOLD &&
        hasTriggeredHaptic.current
      ) {
        // Reset if user drags back below threshold
        hasTriggeredHaptic.current = false;
      }
    })
    .onEnd((event) => {
      const shouldSwipeRight =
        translateX.value > SWIPE_THRESHOLD ||
        event.velocityX > VELOCITY_THRESHOLD;
      const shouldSwipeLeft =
        translateX.value < -SWIPE_THRESHOLD ||
        event.velocityX < -VELOCITY_THRESHOLD;

      if (shouldSwipeRight) {
        translateX.value = withSpring(
          SCREEN_WIDTH * 1.5,
          FLY_OFF_SPRING,
          (finished) => {
            if (finished) {
              runOnJS(onSwipeRight)();
            }
          }
        );
        runOnJS(triggerSuccessHaptic)();
      } else if (shouldSwipeLeft) {
        translateX.value = withSpring(
          -SCREEN_WIDTH * 1.5,
          FLY_OFF_SPRING,
          (finished) => {
            if (finished) {
              runOnJS(onSwipeLeft)();
            }
          }
        );
        runOnJS(triggerWarningHaptic)();
      } else {
        // Snap back
        translateX.value = withSpring(0, SNAP_BACK_SPRING);
        translateY.value = withSpring(0, SNAP_BACK_SPRING);
        hasTriggeredHaptic.current = false;
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      {
        rotate: `${interpolate(
          translateX.value,
          [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
          [-10, 0, 10]
        )}deg`,
      },
    ],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.cardContainer, cardStyle]}>
        {children}
        <SwipeOverlay translateX={translateX} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
  },
});
