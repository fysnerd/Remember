/**
 * Selectable chip component for multi-select options
 */

import { Pressable, StyleSheet } from 'react-native';
import { Text } from '../ui';
import { haptics } from '../../lib/haptics';
import { colors, spacing, borderRadius } from '../../theme';

interface SelectChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function SelectChip({ label, selected, onPress }: SelectChipProps) {
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text
        variant="caption"
        weight="medium"
        style={selected ? styles.textSelected : styles.textDefault}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  textDefault: {
    color: colors.textSecondary,
  },
  textSelected: {
    color: colors.background,
  },
});
