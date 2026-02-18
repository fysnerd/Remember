/**
 * Tab Navigator Layout — Native iOS Tab Bar
 *
 * Uses NativeTabs (UITabBarController) for true native feel.
 * iOS 26+: automatic Liquid Glass effect.
 * Older iOS: standard frosted glass tab bar.
 */

import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { colors } from '../../theme';

export default function TabLayout() {
  return (
    <NativeTabs
      tintColor={colors.accent}
    >
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="library">
        <Icon sf={{ default: 'safari', selected: 'safari.fill' }} />
        <Label>Explorer</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="reviews">
        <Icon sf={{ default: 'brain', selected: 'brain.fill' }} />
        <Label>Revisions</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} />
        <Label>Profil</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
