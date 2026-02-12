/**
 * SuggestionCard - Compact glass theme card for Explorer suggestions
 *
 * Similar style to DailyThemeCard but more compact/stacked.
 */

import { View, StyleSheet } from 'react-native';
import { GlassCard } from '../glass/GlassCard';
import { Text } from '../ui';
import { colors, spacing, fonts } from '../../theme';

interface SuggestionCardProps {
  title: string;
  description?: string;
  onPress?: () => void;
}

export function SuggestionCard({ title, description, onPress }: SuggestionCardProps) {
  // title format is "emoji name" - split to show emoji separately
  const emoji = title.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u)?.[0] || '';
  const name = emoji ? title.slice(emoji.length).trim() : title;

  return (
    <GlassCard padding="md" onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {name || title}
          </Text>
          {description && (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          )}
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 72,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emoji: {
    fontSize: 32,
    lineHeight: 38,
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
  },
  description: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
});
