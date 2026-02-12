/**
 * Platform filter chips for the Revisions screen
 *
 * Horizontal scrollable row of filter chips: Tout, YouTube, Spotify, TikTok, Instagram.
 * Active chip uses accent color, inactive uses glass surface styling.
 */

import { ScrollView, Pressable, View, StyleSheet } from 'react-native';
import { PlatformIcon } from '../icons/PlatformIcon';
import { Text } from '../ui';
import { colors, spacing, borderRadius } from '../../theme';

interface CategoryChipsProps {
  selected: string;
  onSelect: (value: string) => void;
}

const CATEGORIES = [
  { value: 'all', label: 'Tout' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'spotify', label: 'Spotify' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
];

export function CategoryChips({ selected, onSelect }: CategoryChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scroll}
    >
      {CATEGORIES.map((cat) => {
        const isActive = selected === cat.value;
        return (
          <Pressable
            key={cat.value}
            style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
            onPress={() => onSelect(cat.value)}
          >
            <View style={styles.chipContent}>
              {cat.value !== 'all' && (
                <PlatformIcon
                  platform={cat.value}
                  size={14}
                  color={isActive ? colors.background : undefined}
                  colored={!isActive}
                />
              )}
              <Text
                variant="caption"
                weight="medium"
                style={{ color: isActive ? colors.background : colors.textSecondary }}
              >
                {cat.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginBottom: spacing.sm,
  },
  container: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  chipActive: {
    backgroundColor: colors.accent,
  },
  chipInactive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
