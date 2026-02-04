/**
 * Badge component for notifications
 */

import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors, spacing } from '../../theme';

type BadgeColor = 'default' | 'error' | 'success';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  count: number;
  color?: BadgeColor;
  size?: BadgeSize;
}

const colorMap: Record<BadgeColor, string> = {
  default: colors.accent,
  error: colors.error,
  success: colors.success,
};

const sizeMap: Record<BadgeSize, { minWidth: number; height: number; fontSize: number }> = {
  sm: { minWidth: 18, height: 18, fontSize: 10 },
  md: { minWidth: 22, height: 22, fontSize: 12 },
};

export function Badge({ count, color = 'error', size = 'md' }: BadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > 99 ? '99+' : count.toString();
  const sizeStyle = sizeMap[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colorMap[color],
          minWidth: sizeStyle.minWidth,
          height: sizeStyle.height,
          borderRadius: sizeStyle.height / 2,
        },
      ]}
    >
      <Text
        variant="label"
        color="inverse"
        weight="bold"
        style={{ fontSize: sizeStyle.fontSize }}
      >
        {displayCount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
});
