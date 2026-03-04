/**
 * Pipeline status badge overlay for ContentCard thumbnails
 *
 * Shows processing status (SELECTED, TRANSCRIBING, GENERATING, FAILED, UNSUPPORTED)
 * Returns null for non-processing states (READY, INBOX, ARCHIVED)
 */

import { View, StyleSheet } from 'react-native';
import { Clock, Mic, Sparkles, AlertCircle, Ban } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Text } from '../ui';
import { colors, borderRadius, spacing, fonts, typography } from '../../theme';
import type { ContentStatus } from '../../types/content';

const STATUS_CONFIG: Record<string, { icon: typeof Clock; label: string; color: string }> = {
  SELECTED: { icon: Clock, label: 'En attente', color: colors.textTertiary },
  TRANSCRIBING: { icon: Mic, label: 'Transcription...', color: colors.accent },
  GENERATING: { icon: Sparkles, label: 'Quiz en creation...', color: colors.success },
  FAILED: { icon: AlertCircle, label: 'Erreur', color: colors.error },
  UNSUPPORTED: { icon: Ban, label: 'Non supporte', color: colors.textTertiary },
};

export function PipelineStatusBadge({ status }: { status: ContentStatus }) {
  const config = STATUS_CONFIG[status];
  if (!config) return null; // READY, INBOX, ARCHIVED -- no badge

  const Icon = config.icon;

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.container}>
      <View style={styles.badge}>
        <Icon size={10} color={config.color} />
        <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
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
