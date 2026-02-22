/**
 * Library Stack Layout — Native header with UISearchController
 *
 * Provides native iOS search bar (Liquid Glass on iOS 26+),
 * large collapsing title, and filter button in headerRight.
 * Header is hidden in triage mode.
 *
 * No custom headerStyle/headerTransparent/headerBlurEffect —
 * iOS 26 applies Liquid Glass automatically when the nav bar
 * appearance is not overridden. ThemeProvider (DarkTheme) from
 * the parent tab layout handles dark mode colors.
 */

import { Stack } from 'expo-router';
import { Pressable } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';
import { useContentStore } from '../../../stores/contentStore';
import { colors } from '../../../theme';

export default function LibraryLayout() {
  const { viewMode, setSearchQuery, sourceFilters, setShowFilterDrawer } = useContentStore();
  const isTriage = viewMode === 'triage';
  const isFilterActive = sourceFilters.length > 0;

  return (
    <Stack
      screenOptions={{
        headerShown: !isTriage,
        headerLargeTitle: true,
        title: 'Explorer',
        headerSearchBarOptions: {
          placeholder: 'Rechercher...',
          hideWhenScrolling: false,
          placement: 'stacked',
          barTintColor: 'transparent',
          onChangeText: (e: any) => {
            const text = typeof e === 'string' ? e : e?.nativeEvent?.text ?? '';
            setSearchQuery(text);
          },
        },
        headerRight: () => (
          <Pressable
            onPress={() => setShowFilterDrawer(true)}
            hitSlop={8}
          >
            <SlidersHorizontal
              size={20}
              color={isFilterActive ? colors.accent : colors.textSecondary}
              strokeWidth={1.75}
            />
          </Pressable>
        ),
        headerBackVisible: false,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
