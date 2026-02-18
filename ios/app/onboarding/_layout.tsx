/**
 * Onboarding Stack Layout
 *
 * Slide-from-right transitions, no header, gesture navigation disabled
 * so users follow the linear onboarding flow.
 */

import { Stack } from 'expo-router';
import { colors } from '../../theme';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
        animationDuration: 300,
      }}
    />
  );
}
