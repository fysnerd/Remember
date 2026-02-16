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

/**
 * CardDisplay - Full-width card visual for swipe stack
 * Mirrors ContentCard styling but sized for swipe mode.
 */
function CardDisplay({ item }: { item: Content }) {
  const durationText = formatDuration(item.duration);

  return (
    <View style={styles.card}>
      <View style={styles.thumbnailContainer}>
        {item.thumbnailUrl ? (
          <Image
            source={{ uri: item.thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <PlatformIcon platform={item.source} size={32} color={colors.textTertiary} />
          </View>
        )}
        {/* Platform badge - top left */}
        <View style={styles.badgeOverlay}>
          <View style={styles.badge}>
            <PlatformIcon platform={item.source} size={12} color="#FFFFFF" />
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
      </View>
      <View style={styles.infoContainer}>
        <Text variant="body" weight="semibold" numberOfLines={2} style={styles.title}>
          {item.title}
        </Text>
        {item.channelName && (
          <Text variant="caption" color="secondary" numberOfLines={1} style={styles.channelName}>
            {item.channelName}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cardsArea: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  cardWrapper: {
    justifyContent: 'flex-start',
  },
  card: {
    width: '100%',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...shadows.md,
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
    top: spacing.sm,
    left: spacing.sm,
  },
  badge: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: borderRadius.xs,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    borderRadius: borderRadius.xs,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  durationText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  infoContainer: {
    padding: spacing.md,
  },
  title: {
    color: colors.text,
  },
  channelName: {
    marginTop: spacing.xs,
  },
});
