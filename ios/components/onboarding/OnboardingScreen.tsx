/**
 * Onboarding screen layout wrapper
 *
 * Provides consistent structure for all onboarding steps:
 * SafeArea -> ProgressBar -> header (back + title + subtitle) -> scrollable content -> pinned footer.
 */

import { ReactNode } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { ProgressBar } from './ProgressBar';
import { Text } from '../ui';
import { colors, spacing, layout } from '../../theme';

interface OnboardingScreenProps {
  /** Progress value between 0 and 1 */
  progress: number;
  /** Screen title */
  title: string;
  /** Optional subtitle below the title */
  subtitle?: string;
  /** Show back navigation button */
  showBack?: boolean;
  /** Back button handler */
  onBack?: () => void;
  /** Main scrollable content */
  children: ReactNode;
  /** Footer pinned at the bottom (e.g. continue button) */
  footer?: ReactNode;
}

export function OnboardingScreen({
  progress,
  title,
  subtitle,
  showBack = false,
  onBack,
  children,
  footer,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.progressWrapper}>
        <ProgressBar progress={progress} />
      </View>

      <View style={styles.header}>
        {showBack ? (
          <Pressable
            onPress={onBack}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
      </View>

      <View style={styles.titleBlock}>
        <Text variant="h2" weight="bold">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="body" color="secondary" style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressWrapper: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  backPlaceholder: {
    width: 40,
    height: 40,
  },
  titleBlock: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  subtitle: {
    marginTop: spacing.sm,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.xl,
  },
  footer: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
