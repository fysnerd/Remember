/**
 * SwipeCardStack - Card stack manager rendering 2-3 visible cards with depth illusion
 *
 * Only the top card is interactive (wrapped in SwipeCard with Gesture.Pan).
 * Behind cards are scaled down and offset for depth. Advances through items
 * on swipe. Fires onNearEnd when 5 items remain for pagination pre-fetch.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import { SwipeCard } from './SwipeCard';
import { PlatformIcon } from '../icons';
import { Text } from '../ui';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import type { Content } from '../../types/content';

const VISIBLE_COUNT = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;

interface SwipeCardStackProps {
  items: Content[];
  onSwipeRight: (item: Content) => void;
  onSwipeLeft: (item: Content) => void;
  onEmpty: () => void;
  onNearEnd?: () => void;
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

export function SwipeCardStack({
  items,
  onSwipeRight,
  onSwipeLeft,
  onEmpty,
  onNearEnd,
}: SwipeCardStackProps) {
  const currentIndexRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  const visibleItems = items.slice(currentIndex, currentIndex + VISIBLE_COUNT);

  // Fire onNearEnd when approaching end of loaded items
  useEffect(() => {
    if (items.length - currentIndex <= 5 && items.length > 0) {
      onNearEnd?.();
    }
  }, [currentIndex, items.length, onNearEnd]);

  // Fire onEmpty when no more visible items
  useEffect(() => {
    if (currentIndex >= items.length && items.length > 0) {
      onEmpty();
    }
  }, [currentIndex, items.length, onEmpty]);

  const advanceCard = useCallback(() => {
    // Small delay to avoid gesture/render race condition
    setTimeout(() => {
      currentIndexRef.current += 1;
      setCurrentIndex(currentIndexRef.current);
    }, 50);
  }, []);

  const handleSwipeRight = useCallback(
    (item: Content) => {
      onSwipeRight(item);
      advanceCard();
    },
    [onSwipeRight, advanceCard]
  );

  const handleSwipeLeft = useCallback(
    (item: Content) => {
      onSwipeLeft(item);
      advanceCard();
    },
    [onSwipeLeft, advanceCard]
  );

  if (visibleItems.length === 0) {
    return null;
  }

  // Render cards in REVERSE order so bottom card renders first (correct z-order)
  const reversedItems = [...visibleItems].reverse();

  return (
    <View style={styles.container}>
      <View style={styles.cardsArea}>
        {reversedItems.map((item, reverseIndex) => {
          const actualIndex = visibleItems.length - 1 - reverseIndex;
          const isTop = actualIndex === 0;

          const depthStyle = {
            transform: [
              { scale: 1 - actualIndex * 0.05 },
              { translateY: actualIndex * -8 },
            ],
          };

          const cardContent = (
            <CardDisplay key={item.id} item={item} />
          );

          if (isTop) {
            return (
              <View
                key={item.id}
                style={[StyleSheet.absoluteFill, styles.cardWrapper]}
              >
                <SwipeCard
                  onSwipeRight={() => handleSwipeRight(item)}
                  onSwipeLeft={() => handleSwipeLeft(item)}
                  enabled={true}
                >
                  {cardContent}
                </SwipeCard>
              </View>
            );
          }

          return (
            <View
              key={item.id}
              style={[StyleSheet.absoluteFill, styles.cardWrapper, depthStyle]}
            >
              {cardContent}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  spotify: 'Spotify',
  tiktok: 'TikTok',
  instagram: 'Instagram',
};

/**
 * CardDisplay - Full-page card visual for swipe stack
 * Large thumbnail, source badge, title, author, synopsis, topics.
 */
function CardDisplay({ item }: { item: Content }) {
  const durationText = formatDuration(item.duration);
  const platformLabel = PLATFORM_LABELS[item.source] || item.source;
  const synopsis = item.synopsis || item.description;

  return (
    <View style={styles.card}>
      {/* Large thumbnail area */}
      <View style={styles.thumbnailContainer}>
        {item.thumbnailUrl ? (
          <Image
            source={{ uri: item.thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <PlatformIcon platform={item.source} size={48} color={colors.textTertiary} />
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
      </View>

      {/* Info section */}
      <View style={styles.infoContainer}>
        {/* Source row: platform icon + label */}
        <View style={styles.sourceRow}>
          <PlatformIcon platform={item.source} size={14} colored />
          <Text variant="caption" weight="medium" style={styles.sourceLabel}>
            {platformLabel}
          </Text>
        </View>

        {/* Title */}
        <Text variant="body" weight="semibold" numberOfLines={3} style={styles.title}>
          {item.title}
        </Text>

        {/* Author */}
        {item.channelName && (
          <Text variant="caption" color="secondary" numberOfLines={1} style={styles.channelName}>
            {item.channelName}
          </Text>
        )}

        {/* Synopsis */}
        {synopsis && (
          <Text variant="caption" color="secondary" numberOfLines={4} style={styles.synopsis}>
            {synopsis}
          </Text>
        )}

        {/* Topics tags */}
        {item.topics && item.topics.length > 0 && (
          <View style={styles.topicsRow}>
            {item.topics.slice(0, 4).map((topic) => (
              <View key={topic} style={styles.topicChip}>
                <Text style={styles.topicText}>{topic}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.72; // Full-page feel, leaves room for header/tabs

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cardsArea: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  cardWrapper: {
    justifyContent: 'flex-start',
  },
  card: {
    width: '100%',
    height: CARD_HEIGHT,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...shadows.lg,
  },
  thumbnailContainer: {
    width: '100%',
    height: CARD_HEIGHT * 0.45,
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
  durationOverlay: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
  },
  durationBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  durationText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  infoContainer: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
  },
  channelName: {
    fontSize: 14,
  },
  synopsis: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  topicsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 'auto' as any,
    paddingTop: spacing.sm,
  },
  topicChip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  topicText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
