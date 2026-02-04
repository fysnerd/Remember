/**
 * Root Layout - Providers + Auth Guard + Stack Navigation
 */

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { useAuthStore } from '../stores/authStore';
import { LoadingScreen } from '../components/LoadingScreen';

// Public routes that don't require auth
const PUBLIC_ROUTES = ['login', 'signup'];

export default function RootLayout() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

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

  // Show loading while checking auth
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen
          name="topic/[name]"
          options={{
            headerShown: true,
            headerBackTitle: 'Feed',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="content/[id]"
          options={{
            headerShown: true,
            headerBackTitle: 'Retour',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="quiz/[id]"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="memo/[id]"
          options={{
            headerShown: true,
            title: 'Mémo',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="quiz/topic/[name]"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="memo/topic/[name]"
          options={{
            headerShown: true,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="oauth/[platform]"
          options={{
            headerShown: true,
            title: 'Connexion',
            presentation: 'modal',
          }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
