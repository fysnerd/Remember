/**
 * Onboarding Layout - Stack with animated progress bar
 */

import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0F1A' },
        animation: 'slide_from_right',
        animationDuration: 300,
      }}
    >
      <Stack.Screen name="auth" />
      <Stack.Screen name="name" />
      <Stack.Screen name="interests" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="frequency" />
      <Stack.Screen name="connect" />
      <Stack.Screen name="attribution" />
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="paywall" />
    </Stack>
  );
}
