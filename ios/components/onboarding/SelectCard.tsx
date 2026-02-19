/**
 * Selectable card component for single-select options
 */

import { Pressable, StyleSheet } from 'react-native';
import { Text } from '../ui';
import { haptics } from '../../lib/haptics';
import { colors, spacing, borderRadius } from '../../theme';

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
    gap: 4,
  },
  cardSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(212, 165, 116, 0.08)',
  },
  emoji: {
    marginBottom: 4,
  },
  labelSelected: {
    color: colors.accent,
  },
  description: {
    marginTop: 2,
  },
});
