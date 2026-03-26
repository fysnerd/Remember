/**
 * Cognitive closure screen displayed after completing all digest questions.
 *
 * Shows score percentage, best answer streak, and session duration.
 */

import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy, Flame, Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, Button } from '../ui';
import { colors, spacing, typography } from '../../theme';

interface DigestClosureProps {
  score: number;
  total: number;
  bestStreak: number;
  durationMs: number;
  onClose: () => void;
  canExtend?: boolean;
  onExtend?: () => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function DigestClosure({
  score,
  total,
  bestStreak,
  durationMs,
  onClose,
  canExtend,
  onExtend,
}: DigestClosureProps) {
  const { t } = useTranslation();
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Large percentage */}
        <Text variant="h1" style={styles.percentage}>
          {percentage}%
        </Text>

        {/* Subtitle */}
        <Text variant="body" color="secondary" style={styles.subtitle}>
          {t('digest.correctAnswers', { score, total })}
        </Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Trophy size={24} color={colors.accent} strokeWidth={1.5} />
            <Text variant="body" weight="bold" style={styles.statValue}>
              {score}/{total}
            </Text>
            <Text variant="caption" color="secondary">
              {t('digest.score')}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Flame size={24} color={colors.accent} strokeWidth={1.5} />
            <Text variant="body" weight="bold" style={styles.statValue}>
              {bestStreak}
            </Text>
            <Text variant="caption" color="secondary">
              {t('digest.bestStreak')}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Clock size={24} color={colors.accent} strokeWidth={1.5} />
            <Text variant="body" weight="bold" style={styles.statValue}>
              {formatDuration(durationMs)}
            </Text>
            <Text variant="caption" color="secondary">
              {t('digest.duration')}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {canExtend && onExtend && (
            <Button variant="outline" fullWidth onPress={onExtend} style={styles.extendButton}>
              {t('digest.extendSession', { defaultValue: '2 min de plus ?' })}
            </Button>
          )}
          <Button variant="primary" fullWidth onPress={onClose}>
            {t('common.back')}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  percentage: {
    ...typography.display,
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.xxl,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: spacing.xxl,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    marginTop: spacing.xs,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
  extendButton: {
    marginBottom: spacing.xs,
  },
});
