/**
 * Pipeline status badge overlay for ContentCard thumbnails
 *
 * Shows processing status (SELECTED, TRANSCRIBING, GENERATING, FAILED, UNSUPPORTED)
 * Returns null for non-processing states (READY, INBOX, ARCHIVED)
 */

import { View, StyleSheet } from 'react-native';
import { Clock, Mic, Sparkles, AlertCircle, Ban } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui';
import { colors, borderRadius, spacing, fonts, typography } from '../../theme';
import type { ContentStatus } from '../../types/content';

const STATUS_CONFIG: Record<string, { icon: typeof Clock; labelKey: string; color: string }> = {
  SELECTED: { icon: Clock, labelKey: 'pipeline.waiting', color: colors.textTertiary },
  TRANSCRIBING: { icon: Mic, labelKey: 'pipeline.transcriptionProgress', color: colors.accent },
  GENERATING: { icon: Sparkles, labelKey: 'pipeline.quizCreating', color: colors.success },
  FAILED: { icon: AlertCircle, labelKey: 'pipeline.error', color: colors.error },
  UNSUPPORTED: { icon: Ban, labelKey: 'pipeline.notSupported', color: colors.textTertiary },
};

export function PipelineStatusBadge({ status }: { status: ContentStatus }) {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[status];
  if (!config) return null; // READY, INBOX, ARCHIVED -- no badge

  const Icon = config.icon;

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.container}>
      <View style={styles.badge}>
        <Icon size={10} color={config.color} />
        <Text style={[styles.label, { color: config.color }]}>{t(config.labelKey)}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm - spacing.xxs,
    paddingVertical: spacing.xxs + 1,
    borderRadius: borderRadius.xs,
    backgroundColor: colors.overlayDark,
  },
  label: {
    ...typography.nano,
    fontFamily: fonts.semibold,
  },
});
