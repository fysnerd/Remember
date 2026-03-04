/**
 * Selectable card component for single-select options
 */

import { Pressable, StyleSheet } from 'react-native';
import { Text } from '../ui';
import { haptics } from '../../lib/haptics';
import { colors, spacing, borderRadius, feedback } from '../../theme';

interface SelectCardProps {
  emoji?: string;
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}

export function SelectCard({ emoji, label, description, selected, onPress }: SelectCardProps) {
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={[styles.card, selected && styles.cardSelected]}
    >
      {emoji && <Text variant="h3" style={styles.emoji}>{emoji}</Text>}
      <Text variant="body" weight="medium" style={selected ? styles.labelSelected : undefined}>
        {label}
      </Text>
      {description && (
        <Text variant="caption" color="secondary" style={styles.description}>
          {description}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    gap: spacing.xs,
  },
  cardSelected: {
    borderColor: colors.accent,
    backgroundColor: feedback.selected.background,
  },
  emoji: {
    marginBottom: spacing.xs,
  },
  labelSelected: {
    color: colors.accent,
  },
  description: {
    marginTop: spacing.xxs,
  },
});
