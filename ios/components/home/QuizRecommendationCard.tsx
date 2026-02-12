/**
 * QuizRecommendationCard - Glass card for recommended quiz on Home screen
 *
 * Shows thumbnail (content) or emoji (theme), title, subtitle, due badge, and CTA.
 */

import { View, Image, StyleSheet } from 'react-native';
import { GlassCard } from '../glass/GlassCard';
import { Text } from '../ui';
import { colors, spacing, fonts } from '../../theme';
import type { QuizRecommendation } from '../../types/content';

interface QuizRecommendationCardProps {
  recommendation: QuizRecommendation;
  onPress: () => void;
}

export function QuizRecommendationCard({ recommendation, onPress }: QuizRecommendationCardProps) {
  const { type, title, subtitle, thumbnailUrl, emoji, dueCount, questionCount } = recommendation;

  return (
    <GlassCard padding="lg" onPress={onPress} style={styles.card}>
      {/* Top: Thumbnail/Emoji + Due badge */}
      <View style={styles.header}>
        {type === 'content' && thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} />
        ) : (
          <Text style={styles.emoji}>{emoji || '📚'}</Text>
        )}
        {dueCount > 0 && (
          <View style={styles.dueBadge}>
            <Text style={styles.dueText}>{dueCount} a revoir</Text>
          </View>
        )}
      </View>

      {/* Bottom: Title + subtitle + question count + CTA */}
      <View style={styles.bottom}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
          <View style={styles.dot} />
          <Text style={styles.subtitle}>{questionCount} question{questionCount !== 1 ? 's' : ''}</Text>
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
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.surface,
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
    flexWrap: 'wrap',
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
