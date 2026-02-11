/**
 * TopicChip component for tags/topics
 */

import { Pressable, View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors, spacing, borderRadius } from '../../theme';

interface TopicChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
}

export function TopicChip({
  label,
  selected = false,
  onPress,
  onRemove,
}: TopicChipProps) {
  const chipContent = (
    <View
      style={[
        styles.chip,
        selected ? styles.selected : styles.unselected,
      ]}
    >
      <Text
        variant="caption"
        color={selected ? 'inverse' : 'primary'}
        weight="medium"
      >
        {label}
      </Text>
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={8} style={styles.removeButton}>
          <Text
            variant="caption"
            color={selected ? 'inverse' : 'secondary'}
            weight="bold"
          >
            ×
          </Text>
        </Pressable>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {chipContent}
      </Pressable>
    );
  }

  return chipContent;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  unselected: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: {
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  removeButton: {
    marginLeft: spacing.xs,
  },
  pressed: {
    opacity: 0.8,
  },
});
