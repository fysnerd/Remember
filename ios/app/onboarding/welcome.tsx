/**
 * Welcome Screen - Step 9
 *
 * Celebration screen after onboarding data collection.
 * Shows personalized greeting with haptic success feedback on mount.
 * Full custom layout (no OnboardingScreen wrapper).
 */

import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text, Button } from '../../components/ui';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { haptics } from '../../lib/haptics';
import { colors, spacing, fonts } from '../../theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { firstName, saveStep, isSubmitting } = useOnboardingStore();

  useEffect(() => {
    haptics.success();
  }, []);

  const handleContinue = async () => {
    await saveStep(9);
    router.push('/onboarding/notifications' as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>
          {'\uD83C\uDF89'}
        </Text>

        <Text variant="h1" weight="bold" style={styles.title}>
          {firstName ? `${firstName}, bienvenue !` : 'Bienvenue !'}
        </Text>

        <Text variant="body" color="secondary" style={styles.subtitle}>
          Tout est prêt. Prêt à transformer tes contenus en connaissances ?
        </Text>
      </View>

      <View style={styles.footer}>
        <Button
          variant="primary"
          fullWidth
          size="lg"
          onPress={handleContinue}
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          C'est parti !
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
  emoji: {
    fontSize: 64,
    marginBottom: spacing.xl,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
