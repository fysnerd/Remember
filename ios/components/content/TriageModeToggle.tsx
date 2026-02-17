/**
 * TriageModeToggle - "Trier" button with inbox count badge
 *
 * Opens the swipe triage mode when pressed.
 * Hidden when inboxCount is 0.
 */

import { Pressable, View, StyleSheet } from 'react-native';
import { ArrowLeftRight } from 'lucide-react-native';
import { Text } from '../ui';
import { colors, borderRadius, spacing } from '../../theme';

interface TriageModeToggleProps {
  inboxCount: number;
  onPress: () => void;
}

export function TriageModeToggle({ inboxCount, onPress }: TriageModeToggleProps) {
  if (inboxCount === 0) return null;

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={onPress}
      hitSlop={8}
    >
      <ArrowLeftRight size={16} color={colors.accent} strokeWidth={2} />
      <Text variant="caption" weight="medium" style={styles.label}>Trier</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{inboxCount > 99 ? '99+' : inboxCount}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 6,
  },
  label: {
    color: colors.accent,
    fontSize: 13,
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.background,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
});
