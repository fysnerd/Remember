/**
 * Onboarding Step 10: Paywall (RevenueCat)
 *
 * Displays the RevenueCat paywall configured in the dashboard.
 * Falls back to a placeholder when the native module isn't available (OTA update).
 * On purchase/restore/dismiss → completes onboarding and enters the app.
 */

import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Text, Button } from '../../components/ui';
import { OnboardingProgressBar } from '../../components/onboarding/OnboardingProgressBar';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { isRevenueCatAvailable } from '../../lib/purchases';
import { colors, spacing } from '../../theme';
import { haptics } from '../../lib/haptics';

// Try loading RevenueCatUI (native module, may not be in binary)
let RevenueCatUI: any = null;
try {
  RevenueCatUI = require('react-native-purchases-ui').default;
} catch {
  // Not available — will show placeholder
}

export default function PaywallScreen() {
  const router = useRouter();
  const { saveStep, isSaving } = useOnboardingStore();
  const { updateUser } = useAuthStore();
  const [completing, setCompleting] = useState(false);

  const completeOnboarding = async () => {
    if (completing || isSaving) return;
    setCompleting(true);
    try {
      await saveStep(9);
      updateUser({ onboardingCompleted: true, onboardingStep: 9 });
      router.replace('/(tabs)');
    } catch {
      setCompleting(false);
    }
  };

  const handlePurchaseCompleted = () => {
    haptics.success();
    completeOnboarding();
  };

  const handleRestoreCompleted = () => {
    haptics.success();
    completeOnboarding();
  };

  const handleDismiss = () => {
    completeOnboarding();
  };

  const handleContinuePlaceholder = () => {
    haptics.success();
    completeOnboarding();
  };

  // RevenueCat paywall when native module is available
  if (isRevenueCatAvailable && RevenueCatUI) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <OnboardingProgressBar step={10} />
        <View style={styles.paywallContainer}>
          <RevenueCatUI.Paywall
            onPurchaseCompleted={handlePurchaseCompleted}
            onRestoreCompleted={handleRestoreCompleted}
            onDismiss={handleDismiss}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Placeholder fallback (OTA update — native module not in binary yet)
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
            onPress={handleContinuePlaceholder}
            loading={isSaving || completing}
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
  paywallContainer: {
    flex: 1,
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
