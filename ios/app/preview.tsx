/**
 * Component Preview - Dev only
 * Navigate to /preview on web to see components in isolation.
 */

import { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Text } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { colors, spacing } from '../theme';

// --- Onboarding screens ---
import AuthScreen from './onboarding/auth';
import NameScreen from './onboarding/name';
import InterestsScreen from './onboarding/interests';
import GoalsScreen from './onboarding/goals';
import FrequencyScreen from './onboarding/frequency';
import ConnectScreen from './onboarding/connect';
import AttributionScreen from './onboarding/attribution';
import WelcomeScreen from './onboarding/welcome';
import NotificationsScreen from './onboarding/notifications';
import PaywallScreen from './onboarding/paywall';

// --- Auth screens ---
import LoginScreen from './login';
import SignupScreen from './signup';

// --- Tab screens ---
import HomeScreen from './(tabs)/index';
import LibraryScreen from './(tabs)/library';
import ReviewsScreen from './(tabs)/reviews';
import ProfileScreen from './(tabs)/profile';

// --- Other screens ---
import DigestScreen from './digest';

type ScreenEntry = {
  component: React.ComponentType;
  category: string;
};

const SCREENS: Record<string, ScreenEntry> = {
  // Onboarding
  'Auth': { component: AuthScreen, category: 'Onboarding' },
  'Name': { component: NameScreen, category: 'Onboarding' },
  'Interests': { component: InterestsScreen, category: 'Onboarding' },
  'Goals': { component: GoalsScreen, category: 'Onboarding' },
  'Frequency': { component: FrequencyScreen, category: 'Onboarding' },
  'Connect': { component: ConnectScreen, category: 'Onboarding' },
  'Attribution': { component: AttributionScreen, category: 'Onboarding' },
  'Welcome': { component: WelcomeScreen, category: 'Onboarding' },
  'Notifications': { component: NotificationsScreen, category: 'Onboarding' },
  'Paywall': { component: PaywallScreen, category: 'Onboarding' },
  // Auth
  'Login': { component: LoginScreen, category: 'Auth' },
  'Signup': { component: SignupScreen, category: 'Auth' },
  // Tabs
  'Home (index)': { component: HomeScreen, category: 'Tabs' },
  'Library': { component: LibraryScreen, category: 'Tabs' },
  'Reviews': { component: ReviewsScreen, category: 'Tabs' },
  'Profile': { component: ProfileScreen, category: 'Tabs' },
  // Other
  'Digest': { component: DigestScreen, category: 'Other' },
};

const CATEGORIES = ['Onboarding', 'Auth', 'Tabs', 'Other'];

export default function PreviewScreen() {
  const [active, setActive] = useState<string | null>(null);
  const { isAuthenticated, user, logout } = useAuthStore();

  const handleDevLogin = async () => {
    const { setTokens } = await import('../lib/storage');
    await setTokens(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWx1dXlhYW4wN2N5aXUxMXIxdTl1NjZlIiwiaWF0IjoxNzcxNjAwNjY2LCJleHAiOjE3NzIyMDU0NjZ9.YwsHEjLdY_9FlHEpBCI3IEJ6-OCVsPKLC0bR56b12Ys',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWx1dXlhYW4wN2N5aXUxMXIxdTl1NjZlIiwiaWF0IjoxNzcxNjAwNjY2LCJleHAiOjE3NzQxOTI2NjZ9.UV7PxWwV5EWi9uL1FjEiL5MZ0QjY_VjBl2pbLNTvkKQ',
    );
    useAuthStore.setState({
      user: {
        id: 'cmluuyaan07cyiu11r1u9u66e',
        email: 'antoinepatarin3@gmail.com',
        name: 'Antoine Patarin',
        firstName: 'antoine',
        onboardingCompleted: true,
        onboardingStep: 9,
      },
      isAuthenticated: true,
      isLoading: false,
    });
  };

  const entry = active ? SCREENS[active] : null;

  if (entry) {
    const ActiveComponent = entry.component;
    return (
      <View style={styles.container}>
        <ActiveComponent />
        <Pressable onPress={() => setActive(null)} style={styles.floatingBack}>
          <Text variant="caption" weight="semibold" style={{ color: '#fff' }}>X</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="h2">Component Preview</Text>
        {isAuthenticated ? (
          <View style={styles.loginRow}>
            <Text variant="caption" color="secondary">
              {user?.email}
            </Text>
            <Pressable onPress={() => logout()} style={[styles.devButton, { backgroundColor: 'rgba(255,80,80,0.2)' }]}>
              <Text variant="caption" weight="semibold" style={{ color: '#ff5050' }}>Logout</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={handleDevLogin} style={styles.devButton}>
            <Text variant="caption" weight="semibold" style={{ color: colors.accent }}>
              Login as antoinepatarin3@gmail.com
            </Text>
          </Pressable>
        )}
      </View>
      <ScrollView style={styles.list}>
        {CATEGORIES.map((cat) => {
          const items = Object.entries(SCREENS).filter(([, e]) => e.category === cat);
          if (items.length === 0) return null;
          return (
            <View key={cat} style={styles.category}>
              <Text variant="caption" color="secondary" weight="semibold" style={styles.categoryTitle}>
                {cat.toUpperCase()}
              </Text>
              {items.map(([name]) => (
                <Pressable
                  key={name}
                  onPress={() => setActive(name)}
                  style={styles.item}
                >
                  <Text variant="body" weight="medium">{name}</Text>
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  list: {
    flex: 1,
    padding: spacing.lg,
  },
  category: {
    marginBottom: spacing.lg,
  },
  categoryTitle: {
    marginBottom: spacing.sm,
    letterSpacing: 1,
  },
  item: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.card,
    marginBottom: spacing.sm,
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  devButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'flex-start',
  },
  floatingBack: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});
