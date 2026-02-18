/**
 * Onboarding - Auth Screen
 *
 * Step 2: Account creation with Apple, Google, or Email magic link.
 * Progress: 0.25
 */

import { useState } from 'react';
import { View, Pressable, StyleSheet, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { OnboardingScreen } from '../../components/onboarding/OnboardingScreen';
import { Text } from '../../components/ui';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import api from '../../lib/api';
import { colors, spacing, borderRadius, fonts } from '../../theme';

// Required for Google Auth session
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_IOS_CLIENT_ID = 'GOOGLE_IOS_CLIENT_ID';

export default function OnboardingAuth() {
  const router = useRouter();
  const { firstName, isReturningUser } = useOnboardingStore();
  const { loginWithTokens } = useAuthStore();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  // Google discovery document (must be inside component - it's a hook)
  const googleDiscovery = AuthSession.useAutoDiscovery(
    'https://accounts.google.com'
  );

  const handlePostAuth = async (
    accessToken: string,
    refreshToken: string,
    user: { id: string; email: string; name?: string; onboardingCompleted?: boolean }
  ) => {
    // Save name to profile if we have one from previous step
    if (firstName && !user.name) {
      try {
        await api.post('/users/profile', { name: firstName });
      } catch {
        // Non-blocking: profile update is best-effort
      }
    }

    await loginWithTokens(accessToken, refreshToken, user);

    if (user.onboardingCompleted) {
      router.replace('/(tabs)');
    } else {
      router.push('/onboarding/interests' as any);
    }
  };

  // --- Apple Sign In ---
  const handleApple = async () => {
    setIsLoading('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('No identity token returned');
      }

      const response = await api.post('/auth/apple', {
        identityToken: credential.identityToken,
        firstName: credential.fullName?.givenName || firstName,
      });

      const { accessToken, refreshToken, user } = response.data;
      await handlePostAuth(accessToken, refreshToken, user);
    } catch (error: unknown) {
      // User cancelled is not an error
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'ERR_REQUEST_CANCELED'
      ) {
        return;
      }
      Alert.alert('Erreur', 'La connexion Apple a echoue. Reessaie.');
    } finally {
      setIsLoading(null);
    }
  };

  // --- Google Sign In ---
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'ankora' });

  const [googleRequest, googleResponse, googlePromptAsync] =
    AuthSession.useAuthRequest(
      {
        clientId: GOOGLE_IOS_CLIENT_ID,
        redirectUri,
        scopes: ['openid', 'profile', 'email'],
        responseType: AuthSession.ResponseType.IdToken,
      },
      googleDiscovery
    );

  const handleGoogle = async () => {
    setIsLoading('google');
    try {
      const result = await googlePromptAsync();
      if (result.type !== 'success') {
        setIsLoading(null);
        return;
      }

      const idToken = result.params?.id_token;
      if (!idToken) {
        throw new Error('No ID token returned');
      }

      const response = await api.post('/auth/google', {
        idToken,
        firstName,
      });

      const { accessToken, refreshToken, user } = response.data;
      await handlePostAuth(accessToken, refreshToken, user);
    } catch {
      Alert.alert('Erreur', 'La connexion Google a echoue. Reessaie.');
    } finally {
      setIsLoading(null);
    }
  };

  // --- Email Magic Link ---
  const handleEmail = () => {
    router.push('/onboarding/magic-link' as any);
  };

  return (
    <OnboardingScreen
      progress={0.25}
      title={isReturningUser ? 'Content de te revoir' : 'Crée ton compte'}
      subtitle="Choisis ta méthode de connexion"
      showBack
      onBack={() => router.back()}
    >
      <View style={styles.buttons}>
        {/* Apple Sign In */}
        {Platform.OS === 'ios' && (
          <Pressable
            style={[styles.button, styles.appleButton]}
            onPress={handleApple}
            disabled={isLoading !== null}
          >
            <Text
              variant="body"
              weight="semibold"
              style={styles.appleText}
            >
              Continuer avec Apple
            </Text>
          </Pressable>
        )}

        {/* Google Sign In */}
        <Pressable
          style={[styles.button, styles.googleButton]}
          onPress={handleGoogle}
          disabled={isLoading !== null || !googleRequest}
        >
          <Text
            variant="body"
            weight="semibold"
            style={styles.googleText}
          >
            Continuer avec Google
          </Text>
        </Pressable>

        {/* Email Magic Link */}
        <Pressable
          style={[styles.button, styles.emailButton]}
          onPress={handleEmail}
          disabled={isLoading !== null}
        >
          <Text
            variant="body"
            weight="semibold"
            style={styles.emailText}
          >
            Continuer avec Email
          </Text>
        </Pressable>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  buttons: {
    gap: spacing.md,
  },
  button: {
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  appleButton: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#333333',
  },
  appleText: {
    color: '#FFFFFF',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
  },
  googleText: {
    color: '#1F1F1F',
  },
  emailButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  emailText: {
    color: colors.accent,
  },
});
