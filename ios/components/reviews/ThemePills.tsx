/**
 * ThemePills - Horizontal scrollable theme filter pills
 * Multi-select with accent color. "Tout" clears selection.
 */

import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Text } from '../ui';
import { colors, spacing, borderRadius } from '../../theme';

interface ThemeOption {
  id: string;
  name: string;
}

interface ThemePillsProps {
  themes: ThemeOption[];
  selectedThemeIds: string[];
  onThemeToggle: (themeId: string) => void;
  onClearAll: () => void;
}

export function ThemePills({ themes, selectedThemeIds, onThemeToggle, onClearAll }: ThemePillsProps) {
  if (themes.length === 0) return null;

  const isAllSelected = selectedThemeIds.length === 0;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {/* "Tout" pill */}
        <Pressable
          style={[styles.pill, isAllSelected && styles.pillActive]}
          onPress={onClearAll}
        >
          <Text
            variant="caption"
            weight={isAllSelected ? 'medium' : 'regular'}
            style={[styles.label, isAllSelected && styles.labelActive]}
          >
            Tout
          </Text>
        </Pressable>

        {themes.map((theme) => {
          const isActive = selectedThemeIds.includes(theme.id);
          return (
            <Pressable
              key={theme.id}
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => onThemeToggle(theme.id)}
            >
              <Text
                variant="caption"
                weight={isActive ? 'medium' : 'regular'}
                style={[styles.label, isActive && styles.labelActive]}
                numberOfLines={1}
              >
                {theme.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    marginHorizontal: -spacing.lg,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  pillActive: {
    backgroundColor: 'transparent',
    borderColor: colors.accent,
  },
  label: {
    color: colors.text,
    fontSize: 13,
  },
  labelActive: {
    color: colors.accent,
  },
});
