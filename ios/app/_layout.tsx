/**
 * Root Layout - Providers + Auth Guard + Font Loading + Stack Navigation
 */

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import {
  useFonts,
  Geist_300Light,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from '@expo-google-fonts/geist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { useAuthStore } from '../stores/authStore';
import { useNotifications } from '../hooks/useNotifications';
import { useBackgroundSync } from '../hooks/useBackgroundSync';

// Prevent splash screen from auto-hiding (must be in module scope)
SplashScreen.preventAutoHideAsync();

// Onboarding step → route mapping
const ONBOARDING_ROUTES: Record<number, string> = {
  0: '/onboarding/auth',
  1: '/onboarding/name',
  2: '/onboarding/interests',
  3: '/onboarding/goals',
  4: '/onboarding/frequency',
  5: '/onboarding/connect',
  6: '/onboarding/attribution',
  7: '/onboarding/welcome',
  8: '/onboarding/notifications',
  9: '/onboarding/paywall',
};

export default function RootLayout() {
  const { isAuthenticated, isLoading, user, checkAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Load Geist fonts
  const [fontsLoaded] = useFonts({
    Geist_300Light,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  // Register push notifications (after auth)
  useNotifications(isAuthenticated);

  // Trigger background sync on launch / foreground (cooldown enforced server-side)
  useBackgroundSync(isAuthenticated);

  // Check for OTA updates on mount — download + reload silently
  useEffect(() => {
    if (__DEV__) return;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (_) {}
    })();
  }, []);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Hide splash screen when fonts loaded AND auth check done
  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading]);

  // Auth guard - 3 states: unauthenticated, onboarding, authenticated
  useEffect(() => {
    if (isLoading) return;

    const firstSegment = segments[0] as string;
    const isOnboardingRoute = firstSegment === 'onboarding';
    const isAuthVerifyRoute = firstSegment === 'auth';

    if (!isAuthenticated) {
      // Not logged in → go to onboarding auth (unless already there or on magic link verify)
      if (!isOnboardingRoute && !isAuthVerifyRoute) {
        router.replace('/onboarding/auth');
      }
    } else if (!user?.onboardingCompleted) {
      // Logged in but onboarding incomplete → resume at correct step
      if (!isOnboardingRoute) {
        const step = user?.onboardingStep ?? 1;
        // After auth, minimum step is 1 (name)
        const route = ONBOARDING_ROUTES[Math.max(step, 1)] || '/onboarding/name';
        router.replace(route as any);
      }
    } else {
      // Fully onboarded → go to tabs
      if (isOnboardingRoute || firstSegment === 'login' || firstSegment === 'signup') {
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, isLoading, user?.onboardingCompleted, user?.onboardingStep, segments]);

  // Keep splash screen visible while loading
  if (isLoading || !fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0A0F1A' },
          animation: 'fade',
          animationDuration: 250,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen
          name="content/[id]"
          options={{
            headerShown: true,
            headerBackTitle: 'Retour',
            presentation: 'card',
            headerStyle: { backgroundColor: '#0A0F1A' },
            headerTintColor: '#F8FAFC',
          }}
        />
        <Stack.Screen
          name="quiz/preview/multi"
          options={{
            headerShown: true,
            title: '',
            presentation: 'card',
            headerStyle: { backgroundColor: '#0A0F1A' },
            headerTintColor: '#F8FAFC',
          }}
        />
        <Stack.Screen
          name="quiz/[id]"
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'fade',
            animationDuration: 250,
          }}
        />
        <Stack.Screen
          name="digest"
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'fade',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="memo/[id]"
          options={{
            headerShown: true,
            title: 'Memo',
            presentation: 'card',
            headerStyle: { backgroundColor: '#0A0F1A' },
            headerTintColor: '#F8FAFC',
          }}
        />
        <Stack.Screen
          name="quiz/theme/[id]"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="memo/theme/[id]"
          options={{
            headerShown: true,
            presentation: 'card',
            headerStyle: { backgroundColor: '#0A0F1A' },
            headerTintColor: '#F8FAFC',
          }}
        />
        <Stack.Screen
          name="oauth/[platform]"
          options={{
            headerShown: true,
            title: 'Connexion',
            presentation: 'modal',
            animation: 'slide_from_bottom',
            animationDuration: 300,
            headerStyle: { backgroundColor: '#0A0F1A' },
            headerTintColor: '#F8FAFC',
          }}
        />
        <Stack.Screen
          name="theme/[id]"
          options={{
            headerShown: true,
            headerBackTitle: 'Home',
            presentation: 'card',
            headerStyle: { backgroundColor: '#0A0F1A' },
            headerTintColor: '#F8FAFC',
          }}
        />
        <Stack.Screen
          name="auth/verify"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
