/**
 * ThemeGridCard - Compact glass card for 2-column theme grid in Explorer
 */

import { StyleSheet } from 'react-native';
import { GlassCard } from '../glass/GlassCard';
import { Text } from '../ui';
import { colors, spacing, fonts } from '../../theme';

interface ThemeGridCardProps {
  emoji: string;
  name: string;
  contentCount: number;
  dueCards?: number;
  onPress: () => void;
  onLongPress?: () => void;
}

export function ThemeGridCard({ emoji, name, contentCount, onPress, onLongPress }: ThemeGridCardProps) {
  return (
    <GlassCard padding="md" onPress={onPress} onLongPress={onLongPress} style={styles.card}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.count}>
        {contentCount} contenu{contentCount !== 1 ? 's' : ''}
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 120,
    justifyContent: 'space-between',
  },
  emoji: {
    fontSize: 32,
    lineHeight: 38,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  count: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
});
