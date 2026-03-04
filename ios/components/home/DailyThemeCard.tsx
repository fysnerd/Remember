/**
 * DailyThemeCard - Large glass-styled theme card for Home screen
 *
 * Tall card with big emoji, bold title, stats, and due badge.
 */

import { View, StyleSheet } from 'react-native';
import { GlassCard } from '../glass/GlassCard';
import { Text } from '../ui';
import { colors, spacing, fonts, typography, borderRadius } from '../../theme';
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
    ...typography.hero,
  },
  dueBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + spacing.xxs,
    borderRadius: borderRadius.full,
  },
  dueText: {
    color: colors.background,
    fontFamily: fonts.bold,
    ...typography.labelSmall,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bottom: {
    marginTop: spacing.md,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    ...typography.caption,
  },
  dot: {
    width: spacing.xxs + 1,
    height: spacing.xxs + 1,
    borderRadius: spacing.xxs,
    backgroundColor: colors.textTertiary,
    marginHorizontal: spacing.sm,
  },
  cta: {
    color: colors.accent,
    fontFamily: fonts.semibold,
    ...typography.caption,
  },
});
