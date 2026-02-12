/**
 * Centralized haptic feedback utility with semantic methods.
 *
 * Usage: import { haptics } from '../lib/haptics';
 *        haptics.light();   // button press
 *        haptics.success();  // correct answer
 */

import * as Haptics from 'expo-haptics';

export const haptics = {
  /** Light tap - button press, pull-to-refresh */
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  /** Medium impact - quiz submit, card selection */
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  /** Selection change - tab switch, quiz option pick, filter change */
  selection: () => Haptics.selectionAsync(),
  /** Success - quiz correct, triage batch complete */
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  /** Error - quiz wrong answer */
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  /** Warning - destructive action */
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};
