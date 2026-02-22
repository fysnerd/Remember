/**
 * Tab Navigator Layout
 *
 * Native iOS tab bar with Liquid Glass (iOS 26+).
 * Uses SF Symbols for native icon rendering.
 */

import { useColorScheme } from 'react-native';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { colors } from '../../theme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <NativeTabs
        iconColor={{
          default: colors.textTertiary,
          selected: colors.accent,
        }}
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
            sf={{ default: 'brain.head.profile', selected: 'brain.head.profile.fill' }}
          />
          <NativeTabs.Trigger.Label>Revisions</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person', selected: 'person.fill' }}
          />
          <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  );
}
