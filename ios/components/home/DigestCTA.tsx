/**
 * DigestCTA — Primary CTA on home screen to launch the daily digest.
 *
 * Shows due card count + streak. This is the main daily action.
 * Streak only increments when a digest session is completed.
 */

import { View, StyleSheet, Pressable } from 'react-native';
import { Play, Flame } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui';
import { haptics } from '../../lib/haptics';
import { colors, spacing, fonts, borderRadius, typography } from '../../theme';

interface DigestCTAProps {
  dueCount: number;
  streak: number;
  onPress: () => void;
}

export function DigestCTA({ dueCount, streak, onPress }: DigestCTAProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={() => { haptics.medium(); onPress(); }}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      {/* Left: play icon + text */}
      <View style={styles.playIcon}>
        <Play size={20} color={colors.background} fill={colors.background} />
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>
          {t('home.dailyDigest', { defaultValue: 'Révision du jour' })}
        </Text>
        <Text style={styles.subtitle}>
          {dueCount > 0
            ? (() => {
                const sessionCount = Math.min(dueCount, 10);
                return t('home.digestSubtitle', { count: sessionCount, defaultValue: `${sessionCount} question${sessionCount > 1 ? 's' : ''} · ~5 min` });
              })()
            : t('home.digestAllDone', { defaultValue: 'Tout est révisé pour aujourd\'hui !' })
          }
        </Text>
      </View>

      {/* Right: streak */}
      {streak > 0 && (
        <View style={styles.streakBadge}>
          <Text style={styles.streakCount}>{streak}</Text>
          <Flame size={14} color={colors.warning} fill={colors.warning} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: borderRadius.lg,
    borderCurve: 'continuous',
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  playIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.background,
    fontFamily: fonts.semibold,
    ...typography.h4,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: fonts.regular,
    ...typography.bodySmall,
    letterSpacing: -0.3,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xxs,
  },
  streakCount: {
    color: colors.background,
    fontFamily: fonts.semibold,
    ...typography.body,
    fontVariant: ['lining-nums', 'proportional-nums'],
  },
});
