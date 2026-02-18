/**
 * Selectable pill/chip for onboarding multi-select screens
 *
 * Used for interest tags, topic selection, etc.
 * Provides haptic feedback on press.
 */

import { Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Text } from '../ui';
import { colors, spacing, borderRadius, fonts } from '../../theme';

interface OnboardingChipProps {
  /** Chip label text */
  label: string;
  /** Whether this chip is currently selected */
  selected: boolean;
  /** Press handler to toggle selection */
  onPress: () => void;
}

export function OnboardingChip({ label, selected, onPress }: OnboardingChipProps) {
  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.chip, selected ? styles.chipSelected : styles.chipDefault]}
    >
      <Text
        variant="caption"
        weight="medium"
        style={{ color: selected ? colors.accent : colors.textSecondary }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipDefault: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
  },
  chipSelected: {
    backgroundColor: 'rgba(212, 165, 116, 0.15)',
    borderColor: colors.accent,
  },
});
