/**
 * SwipeCardStack - Cinematic full-page card stack for triage
 *
 * Editorial design: full-bleed thumbnail with gradient fade,
 * glass platform badge, refined info hierarchy, topic chips.
 * 2-3 visible cards with depth illusion, top card interactive.
 *
 * Action buttons: Archive (X), Skip (→), Learn (♥)
 */

import React, { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Image, Dimensions, Pressable } from 'react-native';
import { X, SkipForward, Heart } from 'lucide-react-native';
import { SwipeCard, SwipeCardRef } from './SwipeCard';
import { PlatformIcon } from '../icons';
import { Text } from '../ui';
import { colors, fonts, spacing, borderRadius, glass } from '../../theme';
import { haptics } from '../../lib/haptics';
import type { Content } from '../../types/content';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const VISIBLE_COUNT = 3;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.62;

export interface SwipeCardStackRef {
  triggerUndo: () => void;
  canUndo: boolean;
}

interface SwipeCardStackProps {
  items: Content[];
  onSwipeRight: (item: Content) => void;
  onSwipeLeft: (item: Content) => void;
  onSkip?: (item: Content) => void;
  onUndo?: (item: Content) => void;
  onEmpty: () => void;
  onNearEnd?: () => void;
  onCanUndoChange?: (canUndo: boolean) => void;
}

type LastAction = {
  item: Content;
  action: 'learn' | 'archive' | 'skip';
} | null;

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

export const SwipeCardStack = forwardRef<SwipeCardStackRef, SwipeCardStackProps>(function SwipeCardStack({
  items,
  onSwipeRight,
  onSwipeLeft,
  onSkip,
  onUndo,
  onEmpty,
  onNearEnd,
  onCanUndoChange,
}, ref) {
  const currentIndexRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const topCardRef = useRef<SwipeCardRef>(null);
  const [lastAction, setLastAction] = useState<LastAction>(null);

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

  // Instant advance (no animation delay) for skip
  const advanceCardInstant = useCallback(() => {
    currentIndexRef.current += 1;
    setCurrentIndex(currentIndexRef.current);
  }, []);

  const handleSwipeRight = useCallback(
    (item: Content) => {
      onSwipeRight(item);
      setLastAction({ item, action: 'learn' });
      advanceCard();
    },
    [onSwipeRight, advanceCard]
  );

  const handleSwipeLeft = useCallback(
    (item: Content) => {
      onSwipeLeft(item);
      setLastAction({ item, action: 'archive' });
      advanceCard();
    },
    [onSwipeLeft, advanceCard]
  );

  // Button handlers — imperative swipe triggers handleSwipeLeft/Right which already calls advanceCard
  const handleButtonArchive = useCallback(() => {
    if (visibleItems.length === 0) return;
    if (topCardRef.current) {
      topCardRef.current.swipeLeft();
    }
  }, [visibleItems]);

  const handleButtonLearn = useCallback(() => {
    if (visibleItems.length === 0) return;
    if (topCardRef.current) {
      topCardRef.current.swipeRight();
    }
  }, [visibleItems]);

  const handleButtonSkip = useCallback(() => {
    if (visibleItems.length === 0) return;
    const item = visibleItems[0];
    haptics.light();
    onSkip?.(item);
    setLastAction({ item, action: 'skip' });
    advanceCardInstant();
  }, [visibleItems, onSkip, advanceCardInstant]);

  // Undo: go back one card and notify parent
  const handleUndo = useCallback(() => {
    if (!lastAction || currentIndex === 0) return;
    haptics.medium();
    currentIndexRef.current -= 1;
    setCurrentIndex(currentIndexRef.current);
    onUndo?.(lastAction.item);
    setLastAction(null);
  }, [lastAction, currentIndex, onUndo]);

  // Expose undo to parent
  useImperativeHandle(ref, () => ({
    triggerUndo: handleUndo,
    canUndo: !!lastAction && currentIndex > 0,
  }), [handleUndo, lastAction, currentIndex]);

  // Notify parent of canUndo changes
  useEffect(() => {
    onCanUndoChange?.(!!lastAction && currentIndex > 0);
  }, [lastAction, currentIndex, onCanUndoChange]);

  if (visibleItems.length === 0) {
    return null;
  }

  const reversedItems = [...visibleItems].reverse();

  return (
    <View style={styles.container}>
      <View style={styles.cardsCenter}>
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
                  ref={topCardRef}
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

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.archiveBtn, pressed && styles.actionBtnPressed]}
          onPress={handleButtonArchive}
          hitSlop={4}
        >
          <X size={26} color={colors.error} strokeWidth={2.5} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.skipBtn, pressed && styles.actionBtnPressed]}
          onPress={handleButtonSkip}
          hitSlop={4}
        >
          <SkipForward size={20} color={colors.textSecondary} strokeWidth={2.5} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.learnBtn, pressed && styles.actionBtnPressed]}
          onPress={handleButtonLearn}
          hitSlop={4}
        >
          <Heart size={26} color={colors.success} strokeWidth={2.5} />
        </Pressable>
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Platform config
// ---------------------------------------------------------------------------

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  spotify: '#1DB954',
  tiktok: '#00F2EA',
  instagram: '#E4405F',
};

// ---------------------------------------------------------------------------
// CardDisplay — cinematic editorial card
// ---------------------------------------------------------------------------

type ThumbVariant = 'horizontal' | 'vertical' | 'square';

function getThumbVariant(source: string): ThumbVariant {
  const s = source.toUpperCase();
  if (s === 'TIKTOK' || s === 'INSTAGRAM') return 'vertical';
  if (s === 'SPOTIFY') return 'square';
  return 'horizontal';
}

function CardDisplay({ item }: { item: Content }) {
  const durationText = formatDuration(item.duration);
  const platformColor = PLATFORM_COLORS[item.source] || colors.accent;
  const variant = getThumbVariant(item.source);

  const thumbContent = item.thumbnailUrl ? (
    <Image
      source={{ uri: item.thumbnailUrl }}
      style={
        variant === 'horizontal' ? styles.thumbHorizontal :
        variant === 'vertical' ? styles.thumbVertical :
        styles.thumbSquare
      }
      resizeMode="cover"
    />
  ) : (
    <View style={[
      styles.placeholder,
      variant === 'horizontal' ? styles.thumbHorizontal :
      variant === 'vertical' ? styles.thumbVertical :
      styles.thumbSquare,
    ]}>
      <PlatformIcon platform={item.source} size={48} color={colors.textTertiary} />
    </View>
  );

  return (
    <View style={styles.card}>
      {/* ---- Thumbnail wrapper — centers the image ---- */}
      <View style={styles.thumbWrapper}>
        <View style={styles.thumbInner}>
          {thumbContent}

          {/* Duration badge — bottom right (YouTube only) */}
          {item.source === 'youtube' && durationText && (
            <View style={styles.durationWrap}>
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{durationText}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* ---- Info section ---- */}
      <View style={styles.infoContainer}>
        <Text numberOfLines={2} style={styles.title}>
          {item.title}
        </Text>

        <View style={styles.metaRow}>
          <View style={[styles.platformDot, { backgroundColor: platformColor }]} />
          <Text numberOfLines={1} style={styles.channelName}>
            {item.channelName || item.source}
          </Text>
          {item.source === 'youtube' && durationText && (
            <>
              <Text style={styles.metaSep}>·</Text>
              <Text style={styles.metaText}>{durationText}</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const ACTION_BTN_SIZE = 64;
const SKIP_BTN_SIZE = 48;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cardsCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardsArea: {
    height: CARD_HEIGHT,
    width: '100%',
    paddingHorizontal: spacing.xl,
  },
  cardWrapper: {
    justifyContent: 'flex-start',
  },

  // Card shell — matches home card aesthetic
  card: {
    width: '100%',
    height: CARD_HEIGHT,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderCurve: 'continuous',
    borderWidth: 2,
    borderColor: glass.borderLight,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },

  // ---- Thumbnail ----
  thumbWrapper: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // YouTube — 16:9 horizontal, full width, rounded
  thumbHorizontal: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  // TikTok / Instagram — 9:16 portrait, full height, centered
  thumbVertical: {
    height: '100%',
    aspectRatio: 9 / 16,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  // Spotify — square, centered
  thumbSquare: {
    height: '85%',
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },

  // Platform dot
  platformDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  // Duration badge
  durationWrap: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
  },
  durationBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: borderRadius.xs,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  durationText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },

  // ---- Info section ----
  infoContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },

  // Title
  title: {
    fontFamily: fonts.semibold,
    fontSize: 20,
    lineHeight: 24,
    color: colors.text,
    letterSpacing: -0.8,
  },

  // Meta row (platform dot + channel + duration)
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  channelName: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  metaSep: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textTertiary,
  },
  metaText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    letterSpacing: -0.3,
  },

  // ---- Action buttons ----
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    paddingVertical: spacing.lg,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  actionBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.92 }],
  },
  archiveBtn: {
    width: ACTION_BTN_SIZE,
    height: ACTION_BTN_SIZE,
    borderRadius: ACTION_BTN_SIZE / 2,
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderColor: 'rgba(239, 68, 68, 0.30)',
  },
  skipBtn: {
    width: SKIP_BTN_SIZE,
    height: SKIP_BTN_SIZE,
    borderRadius: SKIP_BTN_SIZE / 2,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    borderColor: 'rgba(148, 163, 184, 0.20)',
  },
  learnBtn: {
    width: ACTION_BTN_SIZE,
    height: ACTION_BTN_SIZE,
    borderRadius: ACTION_BTN_SIZE / 2,
    backgroundColor: 'rgba(34, 197, 94, 0.10)',
    borderColor: 'rgba(34, 197, 94, 0.30)',
  },
});
