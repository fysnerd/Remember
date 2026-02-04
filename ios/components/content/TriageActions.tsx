/**
 * Triage action buttons - Icon only (X / ✓)
 */

import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text } from '../ui';
import { colors, spacing, borderRadius } from '../../theme';

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
          <Text style={styles.ignoreIcon}>✕</Text>
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
          <Text style={styles.learnIcon}>✓</Text>
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
    height: 40,
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
  ignoreIcon: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  learnIcon: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.background,
  },
  pressed: {
    opacity: 0.7,
  },
});
