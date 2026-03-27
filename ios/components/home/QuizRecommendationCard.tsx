/**
 * QuizRecommendationCard - Home screen daily quiz card
 *
 * Four layout variants:
 * - Horizontal (YouTube): full-width 16:9 thumbnail (Figma 130:309)
 * - Vertical (TikTok/Instagram): small portrait 9:16 thumbnail (Figma 130:267)
 * - Square (Spotify): 100×100 album/podcast cover (Figma 130:137)
 * - Theme: full background image, light info pill at bottom (Figma 130:98)
 * Completed cards show a checkmark and reduced opacity.
 */

import { View, Image, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui';
import { PlatformIcon } from '../icons';
import { Sparkles } from 'lucide-react-native';
import { haptics } from '../../lib/haptics';
import { colors, spacing, fonts, borderRadius, glass, typography, shadows } from '../../theme';
import type { QuizRecommendation } from '../../types/content';

interface QuizRecommendationCardProps {
  recommendation: QuizRecommendation;
  onPress: () => void;
}

type CardVariant = 'horizontal' | 'vertical' | 'square' | 'theme';

function getCardVariant(type: string, platform: string | null): CardVariant {
  if (type === 'theme') return 'theme';
  const p = platform?.toUpperCase();
  if (p === 'TIKTOK' || p === 'INSTAGRAM') return 'vertical';
  if (p === 'SPOTIFY') return 'square';
  return 'horizontal';
}

// --- Theme card (Figma 130:98) ---

function ThemeCard({ recommendation, completed }: { recommendation: QuizRecommendation; completed: boolean }) {
  const { t } = useTranslation();
  const { title, thumbnailUrl, questionCount, dueCount, subtitle } = recommendation;
  const displayCount = dueCount > 0 ? Math.min(dueCount, 20) : questionCount;

  return (
    <View style={[styles.themeCardOuter, completed && styles.cardCompleted]}>
      <View style={styles.themeCard}>
        {/* Background image — AI cover or placeholder */}
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.themeBackground}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.themePlaceholder}>
            <Sparkles size={48} color={colors.accent} />
          </View>
        )}

        {/* Bottom info pill — light background */}
        <View style={styles.themeInfoPill}>
          <Text style={styles.themeTitle} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.themeMetaRow}>
            <Text style={styles.themeMeta}>
              {dueCount > 0
                ? t('quiz.dueCount', { count: displayCount, defaultValue: `${displayCount} à réviser` })
                : t('quiz.questionsCount', { count: questionCount })
              }
            </Text>
            {subtitle && (
              <>
                <Text style={styles.themeMetaSep}>|</Text>
                <Text style={styles.themeMeta}>{subtitle}</Text>
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

// --- Content card (YouTube / TikTok / Instagram / Spotify) ---

function ContentCard({ recommendation, completed }: { recommendation: QuizRecommendation; completed: boolean }) {
  const { t } = useTranslation();
  const { type, title, thumbnailUrl, emoji, platform, questionCount, dueCount } = recommendation;
  const variant = getCardVariant(type, platform);
  const compact = variant === 'vertical' || variant === 'square';
  const displayCount = dueCount > 0 ? Math.min(dueCount, 20) : questionCount;

  return (
    <View style={[styles.card, compact && styles.cardCompact, completed && styles.cardCompleted]}>
      {/* Thumbnail area */}
      {variant === 'horizontal' && (
        <View style={styles.horizontalThumbWrap}>
          {thumbnailUrl ? (
            <Image source={{ uri: thumbnailUrl }} style={styles.fillImage} resizeMode="cover" />
          ) : (
            <View style={styles.placeholderFill}>
              {emoji ? (
                <Text style={styles.emoji}>{emoji}</Text>
              ) : platform ? (
                <PlatformIcon platform={platform as any} size={32} color={colors.textTertiary} />
              ) : null}
            </View>
          )}
        </View>
      )}

      {variant === 'vertical' && (
        <View style={styles.compactThumbWrap}>
          {thumbnailUrl ? (
            <Image source={{ uri: thumbnailUrl }} style={styles.verticalThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.placeholderSmall, styles.verticalThumb]}>
              <PlatformIcon platform={platform as any} size={24} color={colors.textTertiary} />
            </View>
          )}
        </View>
      )}

      {variant === 'square' && (
        <View style={styles.compactThumbWrap}>
          {thumbnailUrl ? (
            <Image source={{ uri: thumbnailUrl }} style={styles.squareThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.placeholderSmall, styles.squareThumb]}>
              <PlatformIcon platform="spotify" size={24} color={colors.textTertiary} />
            </View>
          )}
        </View>
      )}

      {/* Info: Title + question count */}
      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={3}>
          {title}
        </Text>
        <Text style={styles.questionCount}>
          {dueCount > 0
            ? t('quiz.dueCount', { count: displayCount, defaultValue: `${displayCount} à réviser` })
            : t('quiz.questionsCount', { count: questionCount })
          }
        </Text>
      </View>
    </View>
  );
}

// --- Main export ---

export function QuizRecommendationCard({ recommendation, onPress }: QuizRecommendationCardProps) {
  const isTheme = recommendation.type === 'theme';
  const completed = recommendation.completed ?? false;

  return (
    <Pressable
      onPress={() => { haptics.light(); onPress(); }}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {isTheme ? (
        <ThemeCard recommendation={recommendation} completed={completed} />
      ) : (
        <ContentCard recommendation={recommendation} completed={completed} />
      )}
    </Pressable>
  );
}

const CARD_BORDER_WIDTH = 1;
const CARD_SHADOW = {
  shadowColor: colors.black,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.25,
  shadowRadius: 12,
  elevation: 8,
} as const;

const styles = StyleSheet.create({
  // -- Content card shell --
  card: {
    backgroundColor: glass.border,
    borderWidth: CARD_BORDER_WIDTH,
    borderColor: glass.borderLight,
    borderRadius: borderRadius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    padding: spacing.md,
    gap: spacing.sm,
    ...CARD_SHADOW,
  },
  cardCompact: {
    gap: spacing.md,
  },
  cardCompleted: {
    opacity: 0.5,
  },

  // -- Horizontal thumbnail (YouTube) --
  horizontalThumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: borderRadius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  fillImage: {
    width: '100%',
    height: '100%',
  },

  // -- Compact thumbnail wrapper (Vertical + Square) --
  compactThumbWrap: {},

  // -- Vertical thumbnail (TikTok / Instagram) --
  verticalThumb: {
    width: 90,
    height: 156,
    borderRadius: borderRadius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },

  // -- Square thumbnail (Spotify) --
  squareThumb: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },

  // -- Content shared --
  placeholderFill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  placeholderSmall: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: typography.hero.fontSize,
  },
  infoContainer: {
    gap: spacing.xxs,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.semibold,
    ...typography.h3,
    letterSpacing: -0.8,
  },
  questionCount: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    ...typography.bodySmall,
    letterSpacing: -0.6,
  },

  // -- Theme card (Figma 130:98) --
  themeCardOuter: {
    height: 388,
    backgroundColor: glass.border,
    borderWidth: CARD_BORDER_WIDTH,
    borderColor: glass.borderLight,
    borderRadius: borderRadius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    ...CARD_SHADOW,
  },
  themeCard: {
    flex: 1,
    borderRadius: borderRadius.lg - CARD_BORDER_WIDTH,
    borderCurve: 'continuous',
    overflow: 'hidden',
    padding: spacing.md,
    justifyContent: 'flex-end',
  },
  themeBackground: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  themePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeInfoPill: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
    borderCurve: 'continuous',
    padding: spacing.md,
    gap: spacing.xxs,
  },
  themeTitle: {
    color: colors.textDark,
    fontFamily: fonts.semibold,
    ...typography.h3,
    letterSpacing: -0.8,
  },
  themeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  themeMeta: {
    color: colors.textDarkSecondary,
    fontFamily: fonts.regular,
    ...typography.bodySmall,
    letterSpacing: -0.6,
  },
  themeMetaSep: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    ...typography.bodySmall,
    letterSpacing: -0.6,
  },

  // -- Shared --
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
