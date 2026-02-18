/**
 * ThemePills - Horizontal scrollable theme filter pills for revisions screen
 *
 * Uses GlassContainer for Liquid Glass morphing on iOS 26+.
 */

import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { GlassContainer, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { Text } from '../ui';
import { colors, spacing, borderRadius } from '../../theme';

const useNativeGlass = isGlassEffectAPIAvailable();

interface ThemeOption {
  id: string;
  name: string;
  emoji: string;
}

interface ThemePillsProps {
  themes: ThemeOption[];
  selectedThemeId: string | null;
  onThemeChange: (themeId: string | null) => void;
}

export function ThemePills({ themes, selectedThemeId, onThemeChange }: ThemePillsProps) {
  if (themes.length === 0) return null;

  const pills = [
    <Pressable
      key="all"
      style={[styles.pill, selectedThemeId === null && styles.pillActive]}
      onPress={() => onThemeChange(null)}
    >
      <Text
        variant="caption"
        weight={selectedThemeId === null ? 'medium' : 'regular'}
        style={[styles.label, selectedThemeId === null && styles.labelActive]}
      >
        Tout
      </Text>
    </Pressable>,
    ...themes.map((theme) => {
      const isActive = selectedThemeId === theme.id;
      return (
        <Pressable
          key={theme.id}
          style={[styles.pill, isActive && styles.pillActive]}
          onPress={() => onThemeChange(theme.id)}
        >
          <Text variant="caption" style={styles.emoji}>{theme.emoji}</Text>
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
    }),
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {useNativeGlass ? (
          <GlassContainer spacing={spacing.sm}>
            {pills}
          </GlassContainer>
        ) : (
          pills
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.md,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 4,
  },
  pillActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  emoji: {
    fontSize: 12,
  },
  label: {
    color: colors.text,
    fontSize: 13,
  },
  labelActive: {
    color: colors.background,
  },
});
