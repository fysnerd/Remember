/**
 * Swipeable wrapper around ContentCard for swipe-to-delete
 */

import { useRef } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Trash2 } from 'lucide-react-native';
import { ContentCard } from './ContentCard';
import { Text } from '../ui';
import { colors, spacing, borderRadius } from '../../theme';

type ContentSource = 'youtube' | 'spotify' | 'tiktok' | 'instagram';

interface SwipeableContentCardProps {
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
  onDelete: () => void;
}

export function SwipeableContentCard({
  onDelete,
  ...cardProps
}: SwipeableContentCardProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = () => (
    <Pressable
      style={styles.deleteAction}
      onPress={() => {
        swipeableRef.current?.close();
        onDelete();
      }}
    >
      <Trash2 size={18} color="#FFFFFF" />
      <Text style={styles.deleteText}>Retirer</Text>
    </Pressable>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      rightThreshold={40}
    >
      <ContentCard {...cardProps} />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  deleteAction: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    marginLeft: spacing.sm,
    gap: 4,
  },
  deleteText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
