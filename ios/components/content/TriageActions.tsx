/**
 * Triage action buttons - Icon only (X / Check)
 */

import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { colors, spacing, borderRadius, layout } from '../../theme';

interface TriageActionsProps {
  onLearn: () => void;
  onIgnore: () => void;
  loadingLearn?: boolean;
  loadingIgnore?: boolean;
}

export function TriageActions({ onLearn, onIgnore, loadingLearn = false, loadingIgnore = false }: TriageActionsProps) {
  const isLoading = loadingLearn || loadingIgnore;

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.button, styles.ignoreButton, pressed && styles.pressed]}
        onPress={onIgnore}
        disabled={isLoading}
      >
        {loadingIgnore ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : (
          <X size={18} color={colors.textSecondary} strokeWidth={2} />
        )}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.button, styles.learnButton, pressed && styles.pressed]}
        onPress={onLearn}
        disabled={isLoading}
      >
        {loadingLearn ? (
          <ActivityIndicator size="small" color={colors.background} />
        ) : (
          <Check size={18} color={colors.background} strokeWidth={2} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  button: {
    flex: 1,
    height: layout.buttonHeightSm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ignoreButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  learnButton: {
    backgroundColor: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
