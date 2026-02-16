/**
 * SwipeOverlay — Full-card tinted overlays for keep/dismiss feedback
 *
 * Cinematic design: subtle color wash across the entire card
 * with a frosted icon stamp at center-top, replacing the old
 * corner circle + label approach.
 */

import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import { Check, X } from 'lucide-react-native';
import { Text } from '../ui';
import { colors, fonts, spacing } from '../../theme';

const SWIPE_THRESHOLD = Dimensions.get('window').width * 0.35;

interface SwipeOverlayProps {
  translateX: SharedValue<number>;
}

export function SwipeOverlay({ translateX }: SwipeOverlayProps) {
  // Green keep wash — fades in when swiping right
  const keepWashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD * 0.6, SWIPE_THRESHOLD],
      [0, 0.05, 0.18],
      'clamp'
    ),
  }));

  const keepBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD * 0.4, SWIPE_THRESHOLD],
      [0, 0.3, 1],
      'clamp'
    ),
    transform: [
      {
        scale: interpolate(
          translateX.value,
          [0, SWIPE_THRESHOLD],
          [0.7, 1],
          'clamp'
        ),
      },
    ],
  }));

  // Red dismiss wash — fades in when swiping left
  const dismissWashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.6, 0],
      [0.18, 0.05, 0],
      'clamp'
    ),
  }));

  const dismissBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.4, 0],
      [1, 0.3, 0],
      'clamp'
    ),
    transform: [
      {
        scale: interpolate(
          translateX.value,
          [-SWIPE_THRESHOLD, 0],
          [1, 0.7],
          'clamp'
        ),
      },
    ],
  }));

  return (
    <>
      {/* Keep: green wash + badge */}
      <Animated.View
        style={[styles.wash, { backgroundColor: '#22C55E' }, keepWashStyle]}
        pointerEvents="none"
      />
      <Animated.View style={[styles.badge, styles.keepBadge, keepBadgeStyle]} pointerEvents="none">
        <View style={[styles.iconRing, styles.keepRing]}>
          <Check size={28} color="#FFFFFF" strokeWidth={3} />
        </View>
        <Text style={[styles.label, styles.keepLabel]}>GARDER</Text>
      </Animated.View>

      {/* Dismiss: red wash + badge */}
      <Animated.View
        style={[styles.wash, { backgroundColor: '#EF4444' }, dismissWashStyle]}
        pointerEvents="none"
      />
      <Animated.View style={[styles.badge, styles.dismissBadge, dismissBadgeStyle]} pointerEvents="none">
        <View style={[styles.iconRing, styles.dismissRing]}>
          <X size={28} color="#FFFFFF" strokeWidth={3} />
        </View>
        <Text style={[styles.label, styles.dismissLabel]}>IGNORER</Text>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  // Full-card color wash
  wash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    zIndex: 9,
  },

  // Badge container
  badge: {
    position: 'absolute',
    top: '35%',
    alignItems: 'center',
    zIndex: 10,
  },
  keepBadge: {
    left: spacing.xl,
  },
  dismissBadge: {
    right: spacing.xl,
  },

  // Icon ring
  iconRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  keepRing: {
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  dismissRing: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },

  // Label text
  label: {
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 2,
    marginTop: 8,
  },
  keepLabel: {
    color: colors.success,
  },
  dismissLabel: {
    color: colors.error,
  },
});
