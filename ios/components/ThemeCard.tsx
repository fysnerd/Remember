/**
 * ThemeCard - Pressable card for the home screen theme grid
 *
 * Displays emoji, name, color accent bar, and content count.
 */

import { Pressable, View, StyleSheet } from 'react-native';
import { Text } from './ui';
import { colors, spacing, borderRadius, shadows } from '../theme';

interface ThemeCardProps {
  id: string;
  name: string;
  emoji: string;
  color: string;
  contentCount: number;
  onPress: () => void;
}

export function ThemeCard({ name, emoji, color, contentCount, onPress }: ThemeCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={[styles.colorBar, { backgroundColor: color }]} />
      <View style={styles.content}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text variant="body" weight="medium" numberOfLines={2} style={styles.name}>
          {name}
        </Text>
        <Text variant="caption" color="secondary">
          {contentCount} contenu{contentCount !== 1 ? 's' : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardPressed: {
    opacity: 0.7,
  },
  colorBar: {
    width: 4,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  emoji: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  name: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
});
