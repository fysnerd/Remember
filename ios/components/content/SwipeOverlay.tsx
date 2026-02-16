/**
 * SwipeOverlay - Keep/Dismiss visual indicator overlay
 *
 * Renders green "GARDER" (right swipe) and red "IGNORER" (left swipe)
 * overlays that fade in based on swipe direction using shared translateX value.
 */

import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import { Check, X } from 'lucide-react-native';
import { Text } from '../ui';
import { colors, spacing } from '../../theme';

const SWIPE_THRESHOLD = Dimensions.get('window').width * 0.35;

interface SwipeOverlayProps {
  translateX: SharedValue<number>;
}

export function SwipeOverlay({ translateX }: SwipeOverlayProps) {
  // Green "GARDER" overlay - fades in when swiping right
  const keepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      'clamp'
    ),
  }));

  // Red "IGNORER" overlay - fades in when swiping left
  const dismissStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      'clamp'
    ),
  }));

  return (
    <>
      {/* Keep overlay - top left */}
      <Animated.View style={[styles.overlay, styles.keepOverlay, keepStyle]}>
        <View style={[styles.iconCircle, styles.keepCircle]}>
          <Check size={32} color="#FFFFFF" strokeWidth={3} />
        </View>
        <Text style={styles.keepLabel}>GARDER</Text>
      </Animated.View>

      {/* Dismiss overlay - top right */}
      <Animated.View style={[styles.overlay, styles.dismissOverlay, dismissStyle]}>
        <View style={[styles.iconCircle, styles.dismissCircle]}>
          <X size={32} color="#FFFFFF" strokeWidth={3} />
        </View>
        <Text style={styles.dismissLabel}>IGNORER</Text>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: spacing.lg,
    alignItems: 'center',
    zIndex: 10,
  },
  keepOverlay: {
    left: spacing.lg,
  },
  dismissOverlay: {
    right: spacing.lg,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepCircle: {
    backgroundColor: colors.success,
  },
  dismissCircle: {
    backgroundColor: colors.error,
  },
  keepLabel: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing.xs,
    letterSpacing: 1,
  },
  dismissLabel: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing.xs,
    letterSpacing: 1,
  },
});
