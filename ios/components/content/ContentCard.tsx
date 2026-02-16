/**
 * Content card component with thumbnail + selection support
 * Refined wireframe aesthetic with subtle shadows
 */

import { Pressable, StyleSheet, View, Image } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text } from '../ui';
import { PlatformIcon } from '../icons';
import { PipelineStatusBadge } from './PipelineStatusBadge';
import { colors, spacing, borderRadius, shadows } from '../../theme';
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

  const content = (
    <View style={[styles.card, isSelected && styles.cardSelected]}>
      <View style={styles.thumbnailContainer}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <PlatformIcon platform={source} size={24} color={colors.textTertiary} />
          </View>
        )}
        {/* Source badge - top left */}
        <View style={styles.badgeOverlay}>
          <View style={styles.badge}>
            <PlatformIcon platform={source} size={9} color="#FFFFFF" />
          </View>
        </View>
        {/* Duration badge - bottom right */}
        {durationText && (
          <View style={styles.durationOverlay}>
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{durationText}</Text>
            </View>
          </View>
        )}
        {/* Selection indicator - top right */}
        {selectionMode && (
          <View style={styles.selectionOverlay}>
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Check size={13} color={colors.background} strokeWidth={3} />}
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
    </View>
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
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.text,
  },
  thumbnailContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    backgroundColor: colors.surfaceElevated,
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: borderRadius.xs,
    paddingHorizontal: 6,
    paddingVertical: 3,
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
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  durationOverlay: {
    position: 'absolute',
    bottom: spacing.xs,
    right: spacing.xs,
  },
  durationBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: borderRadius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  infoContainer: {
    padding: spacing.sm,
    paddingTop: spacing.sm,
    minHeight: 56,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 17,
  },
  channelName: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
