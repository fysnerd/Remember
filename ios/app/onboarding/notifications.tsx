/**
 * Onboarding Step 9: Push notification permission
 */

import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text, Button } from '../../components/ui';
import { OnboardingProgressBar } from '../../components/onboarding/OnboardingProgressBar';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing } from '../../theme';
import { haptics } from '../../lib/haptics';

export default function NotificationsScreen() {
  const router = useRouter();
  const { saveStep, isSaving } = useOnboardingStore();
  const { updateUser } = useAuthStore();

  const handleEnable = async () => {
    haptics.light();
    try {
      await Notifications.requestPermissionsAsync();
    } catch {
      // Permission denied — continue anyway
    }
    await goToNext();
  };

  const handleSkip = async () => {
    haptics.light();
    await goToNext();
  };

  const goToNext = async () => {
    try {
      await saveStep(9);
      updateUser({ onboardingStep: 9 });
      router.push('/onboarding/paywall');
    } catch {
      // Error handled in store
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgressBar step={9} />
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.iconContainer}>
          <Text style={styles.bellIcon}>🔔</Text>
        </Animated.View>

        <Text variant="h2" style={styles.title}>
          Reste dans le rythme
        </Text>
        <Text variant="body" color="secondary" style={styles.subtitle}>
          On te rappellera quand c'est le bon moment pour réviser.
        </Text>

        <View style={styles.buttons}>
          <Button
            variant="primary"
            fullWidth
            onPress={handleEnable}
            loading={isSaving}
          >
            Activer les notifications
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onPress={handleSkip}
          >
            Plus tard
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
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  bellIcon: {
    fontSize: 64,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  buttons: {
    gap: spacing.sm,
    marginTop: spacing.xxl,
  },
});
