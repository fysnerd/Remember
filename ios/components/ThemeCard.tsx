/**
 * ThemeCard - Pressable card for the home screen theme grid
 *
 * Displays emoji, name, color accent bar, content count,
 * mastery progress bar, and due card count badge.
 */

import { Pressable, View, StyleSheet } from 'react-native';
import { Text } from './ui';
import { colors, spacing, borderRadius, shadows, fonts, typography } from '../theme';

interface ThemeCardProps {
  id: string;
  name: string;
  emoji: string;
  color: string;
  contentCount: number;
  masteryPercent?: number;
  dueCards?: number;
  onPress: () => void;
}

export function ThemeCard({
  name,
  emoji,
  color,
  contentCount,
  masteryPercent = 0,
  dueCards = 0,
  onPress,
}: ThemeCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={[styles.colorBar, { backgroundColor: color }]} />
      <View style={styles.content}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text variant="body" weight="medium" numberOfLines={2} style={styles.name}>
          {name}
        </Text>
        <Text variant="caption" color="secondary">
          {contentCount} contenu{contentCount !== 1 ? 's' : ''}
        </Text>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              { width: `${Math.min(masteryPercent, 100)}%`, backgroundColor: color },
            ]}
          />
        </View>
      </View>
      {dueCards > 0 && (
        <View style={styles.dueBadge}>
          <Text style={styles.dueText}>{dueCards}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    ...shadows.sm,
  },
  cardPressed: {
    opacity: 0.7,
  },
  colorBar: {
    width: spacing.xs,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  emoji: {
    fontSize: typography.h1.fontSize,
    marginBottom: spacing.xs,
  },
  name: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  progressBarContainer: {
    height: spacing.xxs + 1,
    backgroundColor: colors.borderLight,
    borderRadius: spacing.xxs,
    marginTop: spacing.xs,
    width: '100%',
  },
  progressBar: {
    height: '100%',
    borderRadius: spacing.xxs,
  },
  dueBadge: {
    position: 'absolute',
    top: spacing.sm - spacing.xxs,
    right: spacing.sm - spacing.xxs,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
    minWidth: spacing.lg,
    height: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  dueText: {
    color: colors.white,
    ...typography.labelSmall,
    fontFamily: fonts.semibold,
  },
});
