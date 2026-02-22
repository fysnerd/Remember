/**
 * TriageModeToggle - Floating "X Contenus" pill that opens triage mode
 *
 * Shows the number of new inbox items. Tapping opens swipe triage.
 * Designed as a floating button (positioned by parent).
 * Hidden when inboxCount is 0.
 */

import { Pressable, StyleSheet } from 'react-native';
import { Inbox } from 'lucide-react-native';
import { Text } from '../ui';
import { colors, borderRadius, spacing, layout } from '../../theme';

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
      <Inbox size={20} color={colors.background} strokeWidth={2.2} />
      <Text variant="body" weight="semibold" style={styles.label}>
        {countLabel} Contenu{inboxCount > 1 ? 's' : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: layout.buttonHeight,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent,
    gap: spacing.sm,
  },
  label: {
    color: colors.background,
    fontSize: 17,
  },
  pressed: {
    opacity: 0.8,
  },
});
