/**
 * Tab Navigator Layout
 *
 * Floating glass pill tab bar with press-to-scale animation.
 * Uses GlassView on iOS 26+, BlurView fallback on older versions.
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { House, Compass, Brain, User } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { haptics } from '../../lib/haptics';
import { colors, fonts, glass, borderRadius } from '../../theme';

const useNativeGlass = isGlassEffectAPIAvailable();

const TAB_CONFIG = [
  { name: 'index', label: 'Home', icon: House },
  { name: 'library', label: 'Explorer', icon: Compass },
  { name: 'reviews', label: 'Revisions', icon: Brain },
  { name: 'profile', label: 'Profil', icon: User },
] as const;

/* ───────────────────── Tab Item ───────────────────── */

function TabItem({
  isFocused,
  icon: Icon,
  label,
  onPress,
  onLongPress,
}: {
  isFocused: boolean;
  icon: typeof House;
  label: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const color = isFocused ? colors.accent : colors.textTertiary;

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      onLongPress={onLongPress}
      onPressIn={() => {
        scale.value = withSpring(0.82, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 200 });
      }}
      style={styles.tabItem}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.tabItemInner, animatedStyle]}>
        <Icon
          size={22}
          color={color}
          strokeWidth={isFocused ? 2.25 : 1.5}
        />
        <Text
          style={[
            styles.tabLabel,
            { color, fontFamily: isFocused ? fonts.semibold : fonts.medium },
          ]}
        >
          {label}
        </Text>
        {isFocused && <View style={styles.activeDot} />}
      </Animated.View>
    </Pressable>
  );
}

/* ───────────────────── Floating Tab Bar ───────────────────── */

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom - 8, 12);

  return (
    <View style={[styles.tabBarOuter, { paddingBottom: bottomPadding }]}>
      <View style={styles.tabBarPill}>
        {/* Glass / Blur background */}
        {useNativeGlass ? (
          <GlassView
            glassEffectStyle={glass.liquidGlass.effect}
            style={styles.tabBarGlass}
          />
        ) : (
          <View style={styles.tabBarGlass}>
            <BlurView
              intensity={glass.tabBarIntensity}
              tint={glass.tabBarTint}
              style={StyleSheet.absoluteFill}
            />
            {/* Dark tint overlay for better contrast */}
            <View style={styles.darkOverlay} />
          </View>
        )}

        {/* Subtle border */}
        <View style={styles.tabBarBorder} />

        {/* Tab items */}
        <View style={styles.tabBarContent}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const config = TAB_CONFIG.find((c) => c.name === route.name);
            if (!config) return null;

            return (
              <TabItem
                key={route.key}
                isFocused={isFocused}
                icon={config.icon}
                label={config.label}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }}
                onLongPress={() => {
                  navigation.emit({
                    type: 'tabLongPress',
                    target: route.key,
                  });
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

/* ───────────────────── Tab Layout ───────────────────── */

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.semibold },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', headerShown: false }}
      />
      <Tabs.Screen
        name="library"
        options={{ title: 'Explorer' }}
      />
      <Tabs.Screen
        name="reviews"
        options={{ title: 'Revisions' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil' }}
      />
    </Tabs>
  );
}

/* ───────────────────── Styles ───────────────────── */

const PILL_RADIUS = 28;

const styles = StyleSheet.create({
  /* Outer wrapper — positions pill above safe area */
  tabBarOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  /* The pill container */
  tabBarPill: {
    width: '84%',
    maxWidth: 360,
    height: 62,
    borderRadius: PILL_RADIUS,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  /* Glass / blur fill */
  tabBarGlass: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: PILL_RADIUS,
    overflow: 'hidden',
  },
  /* Dark tint for fallback blur */
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 15, 26, 0.35)',
  },
  /* Border definition */
  tabBarBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: PILL_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  /* Horizontal row of tab items */
  tabBarContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  /* Single tab button */
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginTop: 1,
  },
});
