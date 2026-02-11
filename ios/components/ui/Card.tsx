/**
 * Card container component
 */

import { View, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme';

type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  children: React.ReactNode;
  padding?: CardPadding;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const paddingMap: Record<CardPadding, number> = {
  none: 0,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
};

export function Card({
  children,
  padding = 'md',
  onPress,
  style,
}: CardProps) {
  const cardStyle = [
    styles.base,
    { padding: paddingMap[padding] },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.8,
  },
});
