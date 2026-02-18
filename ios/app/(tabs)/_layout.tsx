/**
 * Tab Navigator Layout — Native iOS Tab Bar
 *
 * Uses NativeTabs (UITabBarController) for true native feel.
 * iOS 26+: automatic Liquid Glass effect.
 * Older iOS: standard frosted glass tab bar.
 */

import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { colors } from '../../theme';

export default function TabLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <NativeTabs
        tintColor={colors.accent}
      >
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'house', selected: 'house.fill' }}
          />
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="library">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'safari', selected: 'safari.fill' }}
          />
          <NativeTabs.Trigger.Label>Explorer</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="reviews">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'brain', selected: 'brain.fill' }}
          />
          <NativeTabs.Trigger.Label>Revisions</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          />
          <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  );
}
