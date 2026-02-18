/**
 * Get Started Screen - Pre-auth choice
 *
 * Lets the user choose between creating an account or logging in.
 * - "Créer un compte" → Name screen → Auth screen
 * - "J'ai déjà un compte" → Auth screen directly (login mode)
 */

import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text, Button } from '../../components/ui';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { colors, spacing, fonts } from '../../theme';

export default function GetStartedScreen() {
  const router = useRouter();
  const { setIsReturningUser } = useOnboardingStore();

  const handleCreateAccount = () => {
    setIsReturningUser(false);
    router.push('/onboarding/name' as any);
  };

  const handleLogin = () => {
    setIsReturningUser(true);
    router.push('/onboarding/auth' as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>ANKORA</Text>
        <Text variant="body" color="secondary" style={styles.tagline}>
          Transforme tes contenus en connaissances
        </Text>
      </View>

      <View style={styles.footer}>
        <Button
          variant="primary"
          fullWidth
          size="lg"
          onPress={handleCreateAccount}
        >
          Créer un compte
        </Button>
        <Button
          variant="ghost"
          fullWidth
          size="lg"
          onPress={handleLogin}
        >
          J'ai déjà un compte
        </Button>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logo: {
    fontFamily: fonts.bold,
    fontSize: 42,
    letterSpacing: 8,
    color: colors.accent,
    marginBottom: spacing.md,
  },
  tagline: {
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
});
