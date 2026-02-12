/**
 * DailyThemeCard - Glass-styled theme card for Home screen
 *
 * Displays emoji, theme name, content count, question count, and due badge.
 */

import { View, StyleSheet } from 'react-native';
import { GlassCard } from '../glass/GlassCard';
import { Text } from '../ui';
import { colors, spacing } from '../../theme';
import type { ThemeListItem } from '../../types/content';

interface DailyThemeCardProps {
  theme: ThemeListItem;
  onPress: () => void;
}

export function DailyThemeCard({ theme, onPress }: DailyThemeCardProps) {
  return (
    <GlassCard padding="lg" onPress={onPress}>
      <View style={styles.row}>
        <Text style={styles.emoji}>{theme.emoji}</Text>
        <View style={styles.info}>
          <Text variant="h3" numberOfLines={1}>
            {theme.name}
          </Text>
          <Text variant="caption" color="secondary">
            {theme.contentCount} contenu{theme.contentCount !== 1 ? 's' : ''} {'\u00B7'} {theme.totalCards} question{theme.totalCards !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {theme.dueCards > 0 && (
        <View style={styles.dueBadge}>
          <Text variant="caption" style={styles.dueText}>
            {theme.dueCards} a revoir
          </Text>
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emoji: {
    fontSize: 32,
  },
  info: {
    flex: 1,
  },
  dueBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  dueText: {
    color: colors.accent,
  },
});
