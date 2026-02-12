/**
 * ThemeGridCard - Compact glass card for 2-column theme grid in Explorer
 */

import { View, StyleSheet } from 'react-native';
import { GlassCard } from '../glass/GlassCard';
import { Text } from '../ui';
import { colors, spacing, fonts } from '../../theme';

interface ThemeGridCardProps {
  emoji: string;
  name: string;
  contentCount: number;
  dueCards: number;
  onPress: () => void;
  onLongPress?: () => void;
}

export function ThemeGridCard({ emoji, name, contentCount, dueCards, onPress, onLongPress }: ThemeGridCardProps) {
  return (
    <GlassCard padding="md" onPress={onPress} onLongPress={onLongPress} style={styles.card}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>
      <View style={styles.meta}>
        <Text style={styles.count}>
          {contentCount} contenu{contentCount !== 1 ? 's' : ''}
        </Text>
        {dueCards > 0 && (
          <View style={styles.dueDot}>
            <Text style={styles.dueText}>{dueCards}</Text>
          </View>
        )}
      </View>
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
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  count: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  dueDot: {
    backgroundColor: colors.accent,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueText: {
    color: colors.background,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
});
