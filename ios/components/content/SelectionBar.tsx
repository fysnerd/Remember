/**
 * Selection bar for batch triage actions
 * Appears at bottom when items are selected
 */

import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui';
import { colors, spacing, borderRadius } from '../../theme';

interface SelectionBarProps {
  selectedCount: number;
  onLearn: () => void;
  onIgnore: () => void;
  onCancel: () => void;
  loadingLearn?: boolean;
  loadingIgnore?: boolean;
}

export function SelectionBar({
  selectedCount,
  onLearn,
  onIgnore,
  onCancel,
  loadingLearn = false,
  loadingIgnore = false,
}: SelectionBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = insets.bottom + 49; // Native tab bar height approximation
  const isLoading = loadingLearn || loadingIgnore;

  return (
    <View style={[styles.container, { bottom: tabBarHeight, paddingBottom: insets.bottom + spacing.sm }]}>
      <View style={styles.content}>
        {/* Cancel button */}
        <Pressable
          style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          onPress={onCancel}
          disabled={isLoading}
        >
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>

        {/* Count */}
        <Text variant="body" weight="medium" style={styles.count}>
          {t('library.selected', { count: selectedCount })}
        </Text>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.actionButton, styles.ignoreButton, pressed && styles.pressed]}
            onPress={onIgnore}
            disabled={isLoading}
          >
            {loadingIgnore ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Text style={styles.ignoreText}>{t('inbox.skip')}</Text>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionButton, styles.learnButton, pressed && styles.pressed]}
            onPress={onLearn}
            disabled={isLoading}
          >
            {loadingLearn ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text style={styles.learnText}>{t('inbox.learn')}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  count: {
    flex: 1,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    minWidth: 80,
    alignItems: 'center',
  },
  ignoreButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  learnButton: {
    backgroundColor: colors.text,
  },
  ignoreText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  learnText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.7,
  },
});
