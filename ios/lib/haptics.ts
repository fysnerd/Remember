/**
 * Centralized haptic feedback utility with semantic methods.
 * Safe wrapper: silently fails if expo-haptics native module is unavailable.
 *
 * Usage: import { haptics } from '../lib/haptics';
 *        haptics.light();   // button press
 *        haptics.success();  // correct answer
 */

import * as Haptics from 'expo-haptics';

function safe(fn: () => Promise<void>): () => void {
  return () => {
    try {
      fn().catch(() => {});
    } catch {
      // Native module not available — silently ignore
    }
  };
}

export const haptics = {
  /** Light tap - button press, pull-to-refresh */
  light: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Medium impact - quiz submit, card selection */
  medium: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Heavy impact - emphasis moments */
  heavy: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  /** Selection change - tab switch, quiz option pick, filter change */
  selection: safe(() => Haptics.selectionAsync()),
  /** Success - quiz correct, triage batch complete */
  success: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Error - quiz wrong answer */
  error: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  /** Warning - destructive action */
  warning: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Double error - strong wrong answer feel */
  doubleError: () => {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))();
    setTimeout(() => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy))(), 200);
  },
  /** Celebration - quiz complete with good score */
  celebration: () => {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))();
    setTimeout(() => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))(), 150);
    setTimeout(() => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium))(), 300);
    setTimeout(() => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy))(), 450);
  },
};
