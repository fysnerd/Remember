/**
 * ThemeGridCard - Compact glass card for 2-column theme grid in Explorer
 */

import { StyleSheet, Pressable, View } from 'react-native';
import { GlassCard } from '../glass/GlassCard';
import { Text } from '../ui';
import { Star } from 'lucide-react-native';
import { colors, spacing, fonts } from '../../theme';

interface ThemeGridCardProps {
  emoji: string;
  name: string;
  contentCount: number;
  dueCards?: number;
  isFavorite?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onToggleFavorite?: () => void;
}

export function ThemeGridCard({ emoji, name, contentCount, isFavorite, onPress, onLongPress, onToggleFavorite }: ThemeGridCardProps) {
  return (
    <GlassCard padding="md" onPress={onPress} onLongPress={onLongPress} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{emoji}</Text>
        {onToggleFavorite && (
          <Pressable onPress={onToggleFavorite} hitSlop={8} style={styles.starButton}>
            <Star
              size={18}
              color={isFavorite ? colors.accent : colors.textTertiary}
              fill={isFavorite ? colors.accent : 'transparent'}
            />
          </Pressable>
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.count}>
        {contentCount} contenu{contentCount !== 1 ? 's' : ''}
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 120,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  emoji: {
    fontSize: 32,
    lineHeight: 38,
  },
  starButton: {
    padding: 2,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  count: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
});
