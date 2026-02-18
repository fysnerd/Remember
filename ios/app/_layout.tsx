/**
 * Root Layout - Providers + Auth Guard + Font Loading + Stack Navigation
 */

import { useEffect, useRef } from 'react';
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
import { initRevenueCat, identifyUser } from '../lib/revenueCat';

// Prevent splash screen from auto-hiding (must be in module scope)
SplashScreen.preventAutoHideAsync();

// Public routes that don't require auth
const PUBLIC_ROUTES = ['login', 'signup', 'onboarding', 'magic-link'];

// Map onboarding step to route for resume
const ONBOARDING_STEP_ROUTES: Record<number, string> = {
  0: '/onboarding/get-started',
  1: '/onboarding/name',
  2: '/onboarding/auth',
  3: '/onboarding/interests',
  4: '/onboarding/objective',
  5: '/onboarding/pace',
  6: '/onboarding/source',
  7: '/onboarding/attribution',
  9: '/onboarding/welcome',
  10: '/onboarding/notifications',
};

export default function RootLayout() {
  const { isAuthenticated, isLoading, checkAuth, user } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const revenueCatInitialized = useRef(false);

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

  // Init RevenueCat
  useEffect(() => {
    if (!revenueCatInitialized.current) {
      revenueCatInitialized.current = true;
      initRevenueCat().catch(() => {});
    }
  }, []);

  // Identify user in RevenueCat after auth
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      identifyUser(user.id).catch(() => {});
    }
  }, [isAuthenticated, user?.id]);

  // Check for OTA updates on mount — download + reload silently
  useEffect(() => {
    if (__DEV__) return;
    (async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
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

  // Auth guard - 3-way redirect based on auth + onboarding state
  useEffect(() => {
    if (isLoading) return;

    const firstSegment = segments[0] as string;
    const isPublicRoute = PUBLIC_ROUTES.includes(firstSegment);

    if (!isAuthenticated && !isPublicRoute) {
      // Not logged in → onboarding splash
      router.replace('/onboarding/splash' as any);
    } else if (isAuthenticated && user && !user.onboardingCompleted) {
      // Logged in but onboarding not done → resume at saved step
      // Don't redirect if already on an onboarding screen
      if (firstSegment !== 'onboarding' && firstSegment !== 'oauth') {
        const step = user.onboardingStep ?? 0;
        // If step <= 2, user is post-auth so go to interests (step 3)
        const resumeStep = step <= 2 ? 3 : step;
        const route = ONBOARDING_STEP_ROUTES[resumeStep] || '/onboarding/interests';
        router.replace(route as any);
      }
    } else if (isAuthenticated && user?.onboardingCompleted && isPublicRoute) {
      // Logged in + onboarding done but on public route → go home
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, user?.onboardingCompleted]);

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
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="magic-link" options={{ headerShown: false }} />
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
      </Stack>
    </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
