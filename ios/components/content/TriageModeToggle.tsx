/**
 * TriageModeToggle - "X nouveaux" pill that opens triage mode
 *
 * Shows the number of new inbox items. Tapping opens swipe triage.
 * Hidden when inboxCount is 0.
 */

import { Pressable, StyleSheet } from 'react-native';
import { Inbox } from 'lucide-react-native';
import { Text } from '../ui';
import { colors, borderRadius, spacing } from '../../theme';

interface TriageModeToggleProps {
  inboxCount: number;
  onPress: () => void;
}

export function TriageModeToggle({ inboxCount, onPress }: TriageModeToggleProps) {
  if (inboxCount === 0) return null;

  const countLabel = inboxCount > 99 ? '99+' : String(inboxCount);

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={onPress}
      hitSlop={8}
    >
      <Inbox size={14} color={colors.accent} strokeWidth={2.2} />
      <Text variant="caption" weight="medium" style={styles.label}>
        {countLabel} nouveau{inboxCount > 1 ? 'x' : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    gap: 5,
  },
  label: {
    color: colors.accent,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
});
