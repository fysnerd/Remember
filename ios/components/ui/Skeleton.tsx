/**
 * Skeleton loading placeholder with pulse animation (Reanimated)
 */

import { useEffect } from 'react';
import { StyleSheet, DimensionValue, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, borderRadius as br } from '../../theme';

type SkeletonVariant = 'text' | 'rect' | 'circle';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  variant?: SkeletonVariant;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius,
  variant = 'rect',
}: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const getRadius = (): number => {
    if (borderRadius !== undefined) return borderRadius;
    switch (variant) {
      case 'circle':
        return typeof height === 'number' ? height / 2 : br.full;
      case 'text':
        return br.sm;
      default:
        return br.sm;
    }
  };

  const style: ViewStyle = {
    width: variant === 'circle' ? height : width,
    height,
    borderRadius: getRadius(),
  };

  return <Animated.View style={[styles.skeleton, style, animatedStyle]} />;
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.surfaceElevated,
  },
});
