/**
 * Push notification registration and handling
 *
 * - Registers for push notifications on app launch (after auth)
 * - Sends Expo push token to backend
 * - Handles notification tap → navigates to Reviews tab
 * - Suppresses foreground notifications (user is already in the app)
 */

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { EventSubscription } from 'expo-modules-core';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import api from '../lib/api';

// Suppress notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Register for push notifications and send token to backend.
 * Call this hook in the root layout after auth is confirmed.
 */
export function useNotifications(isAuthenticated: boolean) {
  const router = useRouter();
  const notificationResponseListener = useRef<EventSubscription>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Register push token
    registerForPushNotifications();

    // Listen for notification taps (background/killed → app opens)
    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const screen = response.notification.request.content.data?.screen as string;
        if (screen) {
          router.push(screen as any);
        } else {
          router.push('/(tabs)/reviews');
        }
      });

    return () => {
      notificationResponseListener.current?.remove();
    };
  }, [isAuthenticated]);
}

async function registerForPushNotifications() {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return;
  }

  try {
    // Check/request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return;
    }

    // Get the Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const pushToken = tokenData.data;
    console.log('Expo push token:', pushToken);

    // Send token to backend
    await api.post('/notifications/push-token', {
      token: pushToken,
      deviceId: Platform.OS,
    });

    // iOS-specific: set badge count to 0 on launch
    if (Platform.OS === 'ios') {
      await Notifications.setBadgeCountAsync(0);
    }
  } catch (error) {
    console.log('Error registering for push notifications:', error);
  }
}
