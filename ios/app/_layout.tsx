/**
 * Root Layout - Providers + Auth Guard + Font Loading + Stack Navigation
 */

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
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

// Public routes that don't require auth
const PUBLIC_ROUTES = ['login', 'signup'];

export default function RootLayout() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
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

  // Auth guard - redirect based on auth state
  useEffect(() => {
    if (isLoading) return;

    const firstSegment = segments[0] as string;
    const isPublicRoute = PUBLIC_ROUTES.includes(firstSegment);

    if (!isAuthenticated && !isPublicRoute) {
      // Not logged in, trying to access protected route -> redirect to login
      router.replace('/login');
    } else if (isAuthenticated && isPublicRoute) {
      // Logged in but on login/signup page -> redirect to tabs
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

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
          name="quiz/[id]"
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'fade',
            animationDuration: 250,
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
