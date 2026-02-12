/**
 * DailyThemeCard - Large glass-styled theme card for Home screen
 *
 * Tall card with big emoji, bold title, stats, and due badge.
 */

import { View, StyleSheet } from 'react-native';
import { GlassCard } from '../glass/GlassCard';
import { Text } from '../ui';
import { colors, spacing, fonts } from '../../theme';
import type { ThemeListItem } from '../../types/content';

interface DailyThemeCardProps {
  theme: ThemeListItem;
  onPress: () => void;
}

export function DailyThemeCard({ theme, onPress }: DailyThemeCardProps) {
  return (
    <GlassCard padding="lg" onPress={onPress} style={styles.card}>
      {/* Top: Emoji + Due badge */}
      <View style={styles.header}>
        <Text style={styles.emoji}>{theme.emoji}</Text>
        {theme.dueCards > 0 && (
          <View style={styles.dueBadge}>
            <Text style={styles.dueText}>{theme.dueCards} a revoir</Text>
          </View>
        )}
      </View>

      {/* Bottom: Title + meta */}
      <View style={styles.bottom}>
        <Text style={styles.title} numberOfLines={2}>
          {theme.name}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.subtitle}>
            {theme.contentCount} contenu{theme.contentCount !== 1 ? 's' : ''}
          </Text>
          <View style={styles.dot} />
          <Text style={styles.cta}>Lancer le quiz</Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 170,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  emoji: {
    fontSize: 48,
    lineHeight: 56,
  },
  dueBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 9999,
  },
  dueText: {
    color: colors.background,
    fontFamily: fonts.bold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bottom: {
    marginTop: spacing.md,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    marginBottom: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.textTertiary,
    marginHorizontal: spacing.sm,
  },
  cta: {
    color: colors.accent,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
});
