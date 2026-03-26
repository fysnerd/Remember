/**
 * Root Layout - Providers + Auth Guard + Font Loading + Stack Navigation
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import '../lib/i18n'; // Side-effect: synchronous i18n init
import { hydrateI18n } from '../lib/i18n';
import { useTranslation } from 'react-i18next';
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
// import { InstagramAutoSync } from '../components/InstagramAutoSync'; // DISABLED 2026-03-26
import { configurePurchases, identifyUser } from '../lib/purchases';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

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
  const { t } = useTranslation();
  const segments = useSegments();
  const router = useRouter();

  // i18n hydration (resolve stored language from SecureStore)
  const [i18nReady, setI18nReady] = useState(false);
  useEffect(() => {
    hydrateI18n().then(() => setI18nReady(true));
  }, []);

  // Load Geist fonts
  const [fontsLoaded] = useFonts({
    Geist_300Light,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  // Register push notifications (only after onboarding is completed,
  // so the onboarding notifications screen can show the iOS permission prompt)
  useNotifications(isAuthenticated && !!user?.onboardingCompleted);

  // Trigger background sync on launch / foreground (cooldown enforced server-side)
  useBackgroundSync(isAuthenticated);

  // Initialize RevenueCat SDK on mount (before any purchase operations)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    configurePurchases();
    GoogleSignin.configure({
      iosClientId: '628216102691-2gfso5k8i4nkd0cq83etbn1767i3k75a.apps.googleusercontent.com',
      webClientId: '628216102691-rapig42ndt06hg1dab93pquvvvnp06r1.apps.googleusercontent.com',
    });
  }, []);

  // Identify user with RevenueCat when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      identifyUser(user.id);
    }
  }, [isAuthenticated, user?.id]);

  // Initialize the new hook for OTA Updates
  const { isUpdateAvailable, isUpdatePending } = Updates.useUpdates();

  // Watch for OTA updates and alert the user when one finishes downloading
  useEffect(() => {
    if (__DEV__) return;

    if (isUpdatePending) {
      import('react-native').then(({ Alert }) => {
        Alert.alert(
          'Mise à jour disponible 🚀',
          'Une nouvelle version a été téléchargée. Voulez-vous redémarrer l\'application pour l\'appliquer ?',
          [
            { text: 'Plus tard', style: 'cancel' },
            { text: 'Redémarrer', style: 'default', onPress: () => Updates.reloadAsync() },
          ]
        );
      });
    }
  }, [isUpdatePending]);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Hide splash screen when fonts loaded AND auth check done AND i18n ready
  useEffect(() => {
    if (fontsLoaded && !isLoading && i18nReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading, i18nReady]);

  // Auth guard - 3 states: unauthenticated, onboarding, authenticated
  useEffect(() => {
    if (isLoading) return;

    const firstSegment = segments[0] as string;
    const isOnboardingRoute = firstSegment === 'onboarding';
    const isAuthVerifyRoute = firstSegment === 'auth';
    const isOAuthRoute = firstSegment === 'oauth';
    const isPreviewRoute = firstSegment === 'preview';
    const isPlaygroundRoute = firstSegment === 'playground';

    if (isPreviewRoute || isPlaygroundRoute) return; // Skip auth guard for dev tools

    if (!isAuthenticated) {
      // Not logged in → go to onboarding auth (unless already there or on magic link verify)
      if (!isOnboardingRoute && !isAuthVerifyRoute) {
        router.replace('/onboarding/auth');
      }
    } else if (!user?.onboardingCompleted) {
      // Logged in but onboarding incomplete → resume at correct step
      // Allow oauth route during onboarding (TikTok/Instagram WebView)
      const secondSegment = segments[1] as string;
      const isStuckOnAuth = isOnboardingRoute && secondSegment === 'auth';
      if ((!isOnboardingRoute && !isOAuthRoute) || isStuckOnAuth) {
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

  // Keep splash screen visible while loading (fonts + auth + i18n)
  if (isLoading || !fontsLoaded || !i18nReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        {/* <InstagramAutoSync isAuthenticated={isAuthenticated} /> DISABLED 2026-03-26 */}
        <Stack
          screenOptions={{
            headerShown: false,
            headerShadowVisible: false,
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
              title: '',
              headerBackTitle: 'Retour',
              headerShadowVisible: false,
              presentation: 'card',
              headerStyle: { backgroundColor: '#0A0F1A' },
              headerTintColor: '#F8FAFC',
              contentStyle: { backgroundColor: '#0A0F1A' },
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
              title: '',
              headerShadowVisible: false,
              presentation: 'card',
              headerStyle: { backgroundColor: '#0A0F1A' },
              headerTintColor: '#F8FAFC',
              contentStyle: { backgroundColor: '#0A0F1A' },
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
              title: t('auth.login'),
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
