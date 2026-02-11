/**
 * Skeleton loading placeholder with pulse animation
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, DimensionValue, ViewStyle } from 'react-native';
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
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

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

  return <Animated.View style={[styles.skeleton, style, { opacity }]} />;
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.surfaceElevated,
  },
});
