/**
 * Tab Navigator Layout
 *
 * Glass blur tab bar with Lucide icons.
 * Tab bar is position: absolute so content scrolls behind the blur.
 */

import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { House, BookOpen, Brain, User } from 'lucide-react-native';
import { colors, fonts, glass } from '../../theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarBackground: () => (
          <BlurView
            intensity={glass.tabBarIntensity}
            tint={glass.tabBarTint}
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: 'transparent',
        },
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontFamily: fonts.semibold,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => <House size={size} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Biblioth\u00e8que',
          tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: 'M\u00e9mos',
          tabBarIcon: ({ color, size }) => <Brain size={size} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
