/**
 * Onboarding Step 10: Paywall placeholder
 * Will be replaced by RevenueCat + StoreKit later
 */

import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Text, Button } from '../../components/ui';
import { OnboardingProgressBar } from '../../components/onboarding/OnboardingProgressBar';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing } from '../../theme';
import { haptics } from '../../lib/haptics';

export default function PaywallScreen() {
  const router = useRouter();
  const { saveStep, isSaving } = useOnboardingStore();
  const { updateUser } = useAuthStore();

  const handleContinue = async () => {
    haptics.success();
    try {
      // Step 9+ marks onboarding as completed on backend
      await saveStep(9);
      updateUser({ onboardingCompleted: true, onboardingStep: 9 });
      // Auth guard in _layout will redirect to /(tabs)
      router.replace('/(tabs)');
    } catch {
      // Error handled in store
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgressBar step={10} />
      <View style={styles.content}>
        <Animated.View entering={FadeIn.duration(500)}>
          <Text style={styles.emoji}>🎁</Text>
          <Text variant="h2" style={styles.title}>
            Profite de ton essai{'\n'}gratuit de 14 jours
          </Text>
          <Text variant="body" color="secondary" style={styles.subtitle}>
            Accès complet à toutes les fonctionnalités. Aucun engagement.
          </Text>
        </Animated.View>

        <View style={styles.bottom}>
          <Button
            variant="primary"
            fullWidth
            onPress={handleContinue}
            loading={isSaving}
          >
            C'est parti !
          </Button>
        </View>
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
    paddingHorizontal: spacing.lg,
  },
  emoji: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: spacing.md,
  },
  bottom: {
    marginTop: spacing.xxl,
  },
});
