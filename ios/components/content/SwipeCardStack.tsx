/**
 * SwipeCardStack - Cinematic full-page card stack for triage
 *
 * Editorial design: full-bleed thumbnail with gradient fade,
 * glass platform badge, refined info hierarchy, topic chips.
 * 2-3 visible cards with depth illusion, top card interactive.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { User, Clock } from 'lucide-react-native';
import { SwipeCard } from './SwipeCard';
import { PlatformIcon } from '../icons';
import { Text } from '../ui';
import { colors, fonts, spacing, borderRadius, glass } from '../../theme';
import type { Content } from '../../types/content';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const VISIBLE_COUNT = 3;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.74;

interface SwipeCardStackProps {
  items: Content[];
  onSwipeRight: (item: Content) => void;
  onSwipeLeft: (item: Content) => void;
  onEmpty: () => void;
  onNearEnd?: () => void;
}

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

  // Stable snapshot: prevents query refetch from removing swiped items mid-stack.
  // Only append truly new items (from pagination); never shrink.
  const seenIdsRef = useRef(new Set<string>(items.map((i) => i.id)));
  const [snapshot, setSnapshot] = useState<Content[]>(items);

  useEffect(() => {
    const newItems = items.filter((item) => !seenIdsRef.current.has(item.id));
    if (newItems.length > 0) {
      newItems.forEach((item) => seenIdsRef.current.add(item.id));
      setSnapshot((prev) => [...prev, ...newItems]);
    }
  }, [items]);

  const visibleItems = snapshot.slice(currentIndex, currentIndex + VISIBLE_COUNT);

  useEffect(() => {
    if (snapshot.length - currentIndex <= 5 && snapshot.length > 0) {
      onNearEnd?.();
    }
  }, [currentIndex, snapshot.length, onNearEnd]);

  useEffect(() => {
    if (currentIndex >= snapshot.length && snapshot.length > 0) {
      onEmpty();
    }
  }, [currentIndex, snapshot.length, onEmpty]);

  const advanceCard = useCallback(() => {
    // 250ms lets the fly-off animation clear the screen before unmounting
    setTimeout(() => {
      currentIndexRef.current += 1;
      setCurrentIndex(currentIndexRef.current);
    }, 250);
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

  const reversedItems = [...visibleItems].reverse();

  return (
    <View style={styles.container}>
      <View style={styles.cardsArea}>
        {reversedItems.map((item, reverseIndex) => {
          const actualIndex = visibleItems.length - 1 - reverseIndex;
          const isTop = actualIndex === 0;

          const depthStyle = {
            transform: [
              { scale: 1 - actualIndex * 0.04 },
              { translateY: actualIndex * -10 },
            ],
          };

          const cardContent = <CardDisplay key={item.id} item={item} />;

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

// ---------------------------------------------------------------------------
// Platform config
// ---------------------------------------------------------------------------

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  spotify: 'Spotify',
  tiktok: 'TikTok',
  instagram: 'Instagram',
};

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  spotify: '#1DB954',
  tiktok: '#00F2EA',
  instagram: '#E4405F',
};

// ---------------------------------------------------------------------------
// CardDisplay — cinematic editorial card
// ---------------------------------------------------------------------------

function CardDisplay({ item }: { item: Content }) {
  const durationText = formatDuration(item.duration);
  const platformLabel = PLATFORM_LABELS[item.source] || item.source;
  const platformColor = PLATFORM_COLORS[item.source] || colors.accent;
  const synopsis = item.synopsis || item.description;

  return (
    <View style={styles.card}>
      {/* ---- Thumbnail with gradient fade ---- */}
      <View style={styles.thumbnailArea}>
        {item.thumbnailUrl ? (
          <Image
            source={{ uri: item.thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <PlatformIcon platform={item.source} size={56} color={colors.textTertiary} />
          </View>
        )}

        {/* Gradient fade — 5 strips from transparent to surface color */}
        <View style={styles.gradientContainer} pointerEvents="none">
          <View style={[styles.gradientStrip, { backgroundColor: 'transparent' }]} />
          <View style={[styles.gradientStrip, { backgroundColor: colors.surface, opacity: 0.15 }]} />
          <View style={[styles.gradientStrip, { backgroundColor: colors.surface, opacity: 0.4 }]} />
          <View style={[styles.gradientStrip, { backgroundColor: colors.surface, opacity: 0.7 }]} />
          <View style={[styles.gradientStrip, { backgroundColor: colors.surface, opacity: 0.92 }]} />
          <View style={[styles.gradientStrip, { backgroundColor: colors.surface }]} />
        </View>

        {/* Platform badge — frosted glass pill, top-left */}
        <View style={styles.platformBadgeWrap}>
          <BlurView intensity={50} tint="dark" style={styles.platformBadge}>
            <View style={[styles.platformDot, { backgroundColor: platformColor }]} />
            <Text style={styles.platformLabel}>{platformLabel}</Text>
          </BlurView>
        </View>

        {/* Duration badge — frosted glass pill, bottom-right */}
        {durationText && (
          <View style={styles.durationWrap}>
            <BlurView intensity={50} tint="dark" style={styles.durationBadge}>
              <Clock size={11} color="rgba(255,255,255,0.7)" strokeWidth={2} />
              <Text style={styles.durationText}>{durationText}</Text>
            </BlurView>
          </View>
        )}
      </View>

      {/* ---- Info section ---- */}
      <View style={styles.infoContainer}>
        {/* Title */}
        <Text numberOfLines={2} style={styles.title}>
          {item.title}
        </Text>

        {/* Author row */}
        {item.channelName && (
          <View style={styles.authorRow}>
            <View style={styles.authorIconWrap}>
              <User size={12} color={colors.accent} strokeWidth={2} />
            </View>
            <Text numberOfLines={1} style={styles.authorName}>
              {item.channelName}
            </Text>
          </View>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Synopsis */}
        {synopsis ? (
          <Text numberOfLines={4} style={styles.synopsis}>
            {synopsis}
          </Text>
        ) : (
          <Text style={styles.synopsisEmpty}>Pas encore de resume disponible</Text>
        )}

        {/* Topics — pinned to bottom */}
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const THUMBNAIL_RATIO = 0.48;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cardsArea: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  cardWrapper: {
    justifyContent: 'flex-start',
  },

  // Card shell
  card: {
    width: '100%',
    height: CARD_HEIGHT,
    borderRadius: 24,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.border,
    ...glass.shadow,
  },

  // ---- Thumbnail ----
  thumbnailArea: {
    width: '100%',
    height: CARD_HEIGHT * THUMBNAIL_RATIO,
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

  // Gradient fade strips
  gradientContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    flexDirection: 'column',
  },
  gradientStrip: {
    flex: 1,
  },

  // Platform badge
  platformBadgeWrap: {
    position: 'absolute',
    top: 14,
    left: 14,
    borderRadius: 20,
    overflow: 'hidden',
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 7,
  },
  platformDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  platformLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Duration badge
  durationWrap: {
    position: 'absolute',
    bottom: 20,
    right: 14,
    borderRadius: 14,
    overflow: 'hidden',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  durationText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontVariant: ['tabular-nums'],
  },

  // ---- Info section ----
  infoContainer: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 2,
    paddingBottom: 20,
  },

  // Title
  title: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
    letterSpacing: -0.3,
  },

  // Author
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  authorIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(212, 165, 116, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorName: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.accent,
    flex: 1,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: glass.border,
    marginTop: 14,
    marginBottom: 14,
  },

  // Synopsis
  synopsis: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  synopsisEmpty: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },

  // Topics
  topicsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 'auto' as any,
    paddingTop: 14,
  },
  topicChip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: glass.borderLight,
  },
  topicText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
});
