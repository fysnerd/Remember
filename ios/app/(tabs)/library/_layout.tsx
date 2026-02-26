/**
 * Library Stack Layout — transparent header with native search bar
 */

import { Stack } from 'expo-router';
import { useContentStore } from '../../../stores/contentStore';
import { colors } from '../../../theme';

export default function LibraryLayout() {
  const setSearchQuery = useContentStore((s) => s.setSearchQuery);

  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerBlurEffect: 'none',
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: '',
          headerLargeTitle: false,
          headerSearchBarOptions: {
            placeholder: 'Rechercher...',
            onChangeText: (e) => setSearchQuery(e.nativeEvent.text),
            onCancelButtonPress: () => setSearchQuery(''),
            tintColor: colors.accent,
            textColor: colors.text,
            headerIconColor: colors.textSecondary,
            hideWhenScrolling: false,
            autoCapitalize: 'none',
          },
        }}
      />
    </Stack>
  );
}
