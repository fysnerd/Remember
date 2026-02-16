/**
 * TriageModeToggle - Toggle button between swipe card stack and bulk select grid
 *
 * When mode='swipe', shows Layers icon (tapping switches to bulk mode)
 * When mode='bulk', shows CreditCard icon (tapping switches to swipe mode)
 */

import { Pressable, StyleSheet } from 'react-native';
import { Layers, CreditCard } from 'lucide-react-native';
import { colors, borderRadius } from '../../theme';

interface TriageModeToggleProps {
  mode: 'swipe' | 'bulk';
  onToggle: () => void;
}

export function TriageModeToggle({ mode, onToggle }: TriageModeToggleProps) {
  const Icon = mode === 'swipe' ? Layers : CreditCard;

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={onToggle}
      hitSlop={8}
    >
      <Icon size={20} color={colors.textSecondary} strokeWidth={1.75} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
});
