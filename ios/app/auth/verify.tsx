/**
 * Magic Link Verification Screen
 * Handles deep link: ankora://auth/verify?token=xxx&email=yyy
 */

import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing } from '../../theme';

export default function VerifyMagicLinkScreen() {
  const { token, email } = useLocalSearchParams<{ token: string; email: string }>();
  const { verifyMagicLink } = useAuthStore();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !email) {
      setError('Lien invalide');
      return;
    }

    (async () => {
      try {
        await verifyMagicLink(token, decodeURIComponent(email));
        // Auth guard in _layout will redirect to onboarding or tabs
      } catch {
        setError('Lien magique invalide ou expiré');
      }
    })();
  }, [token, email]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {error ? (
          <>
            <Text variant="h2" style={styles.centered}>Oups</Text>
            <Text variant="body" color="secondary" style={[styles.centered, { marginTop: spacing.md }]}>
              {error}
            </Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text variant="body" color="secondary" style={[styles.centered, { marginTop: spacing.md }]}>
              Connexion en cours...
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  centered: {
    textAlign: 'center',
  },
});
