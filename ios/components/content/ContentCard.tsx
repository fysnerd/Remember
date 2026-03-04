/**
 * Content card component with thumbnail + selection support
 * Refined wireframe aesthetic with subtle shadows
 */

import { Pressable, StyleSheet, View, Image } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withSpring, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { Check } from 'lucide-react-native';
import { Text } from '../ui';
import { PlatformIcon } from '../icons';
import { PipelineStatusBadge } from './PipelineStatusBadge';
import { colors, spacing, borderRadius, shadows, fonts, typography, glass } from '../../theme';
import type { ContentStatus } from '../../types/content';

type ContentSource = 'youtube' | 'spotify' | 'tiktok' | 'instagram';

interface ContentCardProps {
  id: string;
  title: string;
  source: ContentSource;
  thumbnailUrl?: string;
  channelName?: string;
  duration?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  isSelected?: boolean;
  selectionMode?: boolean;
  status?: ContentStatus;
}

// Format duration in mm:ss or hh:mm:ss
function formatDuration(seconds?: number): string | null {
  if (!seconds) return null;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ContentCard({
  title,
  source,
  thumbnailUrl,
  channelName,
  duration,
  onPress,
  onLongPress,
  isSelected = false,
  selectionMode = false,
  status,
}: ContentCardProps) {
  const durationText = formatDuration(duration);
  const metaText = [channelName, durationText].filter(Boolean).join(' • ');

  // Animated scale for selection feedback
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(isSelected ? 0.96 : 1, {
      damping: 15,
      stiffness: 300,
    });
  }, [isSelected]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const content = (
    <Animated.View style={[styles.card, isSelected && styles.cardSelected, animatedCardStyle]}>
      <View style={styles.thumbnailContainer}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <PlatformIcon platform={source} size={24} color={colors.textTertiary} />
          </View>
        )}
        {/* Duration badge - bottom right */}
        {durationText && (
          <View style={styles.durationOverlay}>
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{durationText}</Text>
            </View>
          </View>
        )}
        {/* Selection overlay - accent tint when selected */}
        {selectionMode && isSelected && (
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(150)}
            style={styles.selectedOverlay}
          />
        )}
        {/* Selection indicator - top right */}
        {selectionMode && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={styles.selectionOverlay}
          >
            <Animated.View
              style={[styles.checkbox, isSelected && styles.checkboxSelected]}
            >
              {isSelected && (
                <Animated.View entering={FadeIn.duration(100)}>
                  <Check size={13} color={colors.background} strokeWidth={3} />
                </Animated.View>
              )}
            </Animated.View>
          </Animated.View>
        )}
        {/* "Nouveau" badge - top right (only in browse mode, not selection mode) */}
        {!selectionMode && status === 'INBOX' && (
          <View style={styles.nouveauOverlay}>
            <View style={styles.nouveauBadge}>
              <Text style={styles.nouveauText}>Nouveau</Text>
            </View>
          </View>
        )}
        {/* Pipeline status badge - bottom left */}
        {status && <PipelineStatusBadge status={status} />}
      </View>
      <View style={styles.infoContainer}>
        <Text variant="caption" numberOfLines={2} weight="medium" style={styles.title}>
          {title}
        </Text>
        {channelName && (
          <Text variant="caption" numberOfLines={1} style={styles.channelName}>
            {channelName}
          </Text>
        )}
      </View>
      {/* Inner border overlay */}
      <View style={[styles.innerBorder, isSelected && styles.innerBorderSelected]} pointerEvents="none" />
    </Animated.View>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={400}
        style={({ pressed }) => pressed && styles.pressed}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: glass.border,
    borderRadius: borderRadius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    ...shadows.md,
  },
  cardSelected: {},
  innerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.md,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: colors.borderLight,
  },
  innerBorderSelected: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  thumbnailContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    backgroundColor: colors.surfaceElevated,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(181, 165, 254, 0.15)',
    zIndex: 1,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOverlay: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
  },
  badge: {
    backgroundColor: colors.overlayStrong,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.sm - spacing.xxs,
    paddingVertical: spacing.xxs + 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionOverlay: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.md + 1,
    backgroundColor: colors.overlayLight,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  nouveauOverlay: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  },
  nouveauBadge: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.sm - spacing.xxs,
    paddingVertical: spacing.xxs,
  },
  nouveauText: {
    ...typography.nano,
    fontFamily: fonts.bold,
    color: colors.background,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  durationOverlay: {
    position: 'absolute',
    bottom: spacing.xs,
    right: spacing.xs,
  },
  durationBadge: {
    backgroundColor: colors.overlayDark,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.sm - spacing.xxs,
    paddingVertical: spacing.xxs,
  },
  durationText: {
    ...typography.micro,
    fontFamily: fonts.medium,
    color: colors.white,
    fontVariant: ['tabular-nums'],
  },
  infoContainer: {
    padding: spacing.sm,
    paddingTop: spacing.sm,
    minHeight: 56,
  },
  title: {
    color: colors.text,
    ...typography.captionSmall,
    height: 34,
  },
  channelName: {
    color: colors.textSecondary,
    ...typography.labelSmall,
    marginTop: spacing.xxs + 1,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
