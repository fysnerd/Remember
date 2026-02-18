/**
 * Safe tab bar height hook for NativeTabs.
 *
 * NativeTabs (UITabBarController) handles content layout natively —
 * the content area already stops above the tab bar. Returns 0 so
 * screens only add their own spacing, not double-padding.
 */

import { useContext } from 'react';
import { BottomTabBarHeightContext } from 'react-native-bottom-tabs';

export function useTabBarHeight(): number {
  const height = useContext(BottomTabBarHeightContext);
  return height ?? 0;
}
