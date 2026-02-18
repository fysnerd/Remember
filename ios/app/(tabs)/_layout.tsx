/**
 * Tab Navigator Layout
 *
 * Floating pill tab bar with Liquid Glass on iOS 26+, BlurView fallback.
 * Tab bar floats above content with rounded corners and margins.
 */

import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { House, Compass, Brain, User } from 'lucide-react-native';
import { TabIcon } from '../../components/icons';
import { haptics } from '../../lib/haptics';
import { colors, fonts, glass, borderRadius } from '../../theme';

const useNativeGlass = isGlassEffectAPIAvailable();

function TabBarBackground() {
  if (useNativeGlass) {
    return (
      <GlassView
        glassEffectStyle={glass.liquidGlass.effect}
        style={styles.tabBarBg}
      />
    );
  }
  return (
    <View style={styles.tabBarBg}>
      <BlurView
        intensity={glass.tabBarIntensity}
        tint={glass.tabBarTint}
        style={StyleSheet.absoluteFill}
      />
    </View>
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
          bottom: 20,
          left: 20,
          right: 20,
          height: 64,
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: 'transparent',
          borderRadius: borderRadius.xl,
          overflow: 'hidden',
          ...glass.shadow,
        },
        tabBarItemStyle: {
          paddingVertical: 6,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 10,
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

const styles = StyleSheet.create({
  tabBarBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
});
