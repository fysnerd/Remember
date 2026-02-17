/**
 * QuizRecommendationCard - Glass card for recommended quiz on Home screen
 *
 * Shows thumbnail (content) or emoji (theme), title, creator name, and date.
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

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays}j`;

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function QuizRecommendationCard({ recommendation, onPress }: QuizRecommendationCardProps) {
  const { type, title, subtitle, thumbnailUrl, emoji, channelName, capturedAt, questionCount } = recommendation;

  return (
    <GlassCard padding="lg" onPress={onPress} style={styles.card}>
      {/* Top: Thumbnail/Emoji */}
      <View style={styles.header}>
        {type === 'content' && thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} />
        ) : (
          <Text style={styles.emoji}>{emoji || '📚'}</Text>
        )}
      </View>

      {/* Bottom: Title + creator + date */}
      <View style={styles.bottom}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.meta}>
          {type === 'content' && channelName ? (
            <Text style={styles.creator} numberOfLines={1}>{channelName}</Text>
          ) : (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          )}
          {type === 'content' && capturedAt && (
            <>
              <View style={styles.dot} />
              <Text style={styles.date}>{formatDate(capturedAt)}</Text>
            </>
          )}
          {type === 'theme' && (
            <>
              <View style={styles.dot} />
              <Text style={styles.date}>{questionCount} question{questionCount !== 1 ? 's' : ''}</Text>
            </>
          )}
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
  creator: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 14,
    flexShrink: 1,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  date: {
    color: colors.textTertiary,
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
});
