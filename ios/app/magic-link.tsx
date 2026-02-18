/**
 * Magic Link Deep Link Handler
 *
 * Handles `ankora://magic-link?token=xxx&email=yyy`
 * Verifies the token, logs the user in, and redirects.
 */

import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text, Button } from '../components/ui';
import { colors, spacing } from '../theme';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';

export default function MagicLinkHandler() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const { loginWithTokens } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    if (params.token && params.email) {
      verifyToken(params.token, params.email);
    } else {
      setError('Lien invalide');
      setVerifying(false);
    }
  }, [params.token, params.email]);

  const verifyToken = async (token: string, email: string) => {
    try {
      const response = await api.post('/auth/magic-link/verify', { token, email });
      const { accessToken, refreshToken, user, isNewUser } = response.data;

      await loginWithTokens(accessToken, refreshToken, user);

      if (isNewUser || !user.onboardingCompleted) {
        // New user or onboarding not done → go to interests (auth is done)
        router.replace('/onboarding/interests' as any);
      } else {
        // Existing user → go home
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.error || 'Ce lien a expiré ou est invalide';
      setError(message);
    } finally {
      setVerifying(false);
    }
  };

  if (verifying) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text variant="body" color="secondary" style={styles.text}>
          Vérification en cours...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text variant="h3" style={styles.text}>
          {error}
        </Text>
        <Button
          variant="primary"
          onPress={() => router.replace('/onboarding/splash' as any)}
          style={{ marginTop: spacing.lg }}
        >
          Retour
        </Button>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  text: {
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
