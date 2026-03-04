/**
 * Library Stack Layout — custom header disabled, managed in screen
 */

import { Stack } from 'expo-router';
import { colors } from '../../../theme';

export default function LibraryLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
