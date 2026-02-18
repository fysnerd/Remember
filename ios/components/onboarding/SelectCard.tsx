/**
 * Large selectable card for onboarding choice screens
 *
 * Used for source selection, goal selection, etc.
 * Displays an icon, label, and optional subtitle.
 * Provides haptic feedback on press.
 */

import { ReactNode } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Text } from '../ui';
import { colors, spacing, borderRadius } from '../../theme';

interface SelectCardProps {
  /** Icon element rendered on the left */
  icon: ReactNode;
  /** Primary label */
  label: string;
  /** Optional description below the label */
  subtitle?: string;
  /** Whether this card is currently selected */
  selected: boolean;
  /** Press handler to toggle selection */
  onPress: () => void;
}

export function SelectCard({ icon, label, subtitle, selected, onPress }: SelectCardProps) {
  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.cardSelected : styles.cardDefault,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
        {icon}
      </View>

      <View style={styles.textContainer}>
        <Text
          variant="body"
          weight="semibold"
          style={{ color: selected ? colors.text : colors.text }}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  cardDefault: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  cardSelected: {
    backgroundColor: 'rgba(212, 165, 116, 0.08)',
    borderColor: colors.accent,
  },
  cardPressed: {
    opacity: 0.85,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerSelected: {
    backgroundColor: 'rgba(212, 165, 116, 0.15)',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.accent,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
});
