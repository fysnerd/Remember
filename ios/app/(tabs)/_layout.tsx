/**
 * Tab Navigator Layout
 *
 * Glass blur tab bar with Lucide icons.
 * Tab bar is position: absolute so content scrolls behind the blur.
 * Uses native Liquid Glass on iOS 26+, BlurView fallback otherwise.
 */

import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { House, Compass, Brain, User } from 'lucide-react-native';
import { TabIcon } from '../../components/icons';
import { haptics } from '../../lib/haptics';
import { colors, fonts, glass } from '../../theme';

const useNativeGlass = isGlassEffectAPIAvailable();

function TabBarBackground() {
  if (useNativeGlass) {
    return (
      <GlassView
        glassEffectStyle={glass.liquidGlass.effect}
        style={StyleSheet.absoluteFill}
      />
    );
  }
  return (
    <BlurView
      intensity={glass.tabBarIntensity}
      tint={glass.tabBarTint}
      style={StyleSheet.absoluteFill}
    />
  );
}

function HeaderBackground() {
  if (useNativeGlass) {
    return (
      <GlassView
        glassEffectStyle={glass.liquidGlass.effect}
        style={StyleSheet.absoluteFill}
      />
    );
  }
  return (
    <BlurView
      intensity={glass.tabBarIntensity}
      tint={glass.tabBarTint}
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          haptics.selection();
        },
      }}
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: 'transparent',
        },
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
        },
        headerBackground: () => <HeaderBackground />,
        headerStyle: {
          backgroundColor: 'transparent',
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
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <TabIcon icon={House} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Explorer',
          tabBarIcon: ({ color, size }) => <TabIcon icon={Compass} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: 'Revisions',
          tabBarIcon: ({ color, size }) => <TabIcon icon={Brain} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <TabIcon icon={User} color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
