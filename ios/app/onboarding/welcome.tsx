/**
 * Onboarding Step 8: Welcome screen with animation
 */

import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Text, Button } from '../../components/ui';
import { OnboardingProgressBar } from '../../components/onboarding/OnboardingProgressBar';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing } from '../../theme';
import { haptics } from '../../lib/haptics';

export default function WelcomeScreen() {
  const router = useRouter();
  const { saveStep, isSaving } = useOnboardingStore();
  const { user, updateUser } = useAuthStore();

  const firstName = user?.firstName || 'toi';

  useEffect(() => {
    haptics.success();
  }, []);

  const handleContinue = async () => {
    haptics.light();
    try {
      await saveStep(8);
      updateUser({ onboardingStep: 8 });
      router.push('/onboarding/notifications');
    } catch {
      // Error handled in store
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgressBar step={8} />
      <View style={styles.content}>
        <Animated.View entering={ZoomIn.duration(500).springify()} style={styles.emojiContainer}>
          <Text variant="h1" style={styles.emoji}>🎉</Text>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(300).duration(600)}>
          <Text variant="h1" style={styles.title}>
            {firstName}, welcome{'\n'}to Ankora!
          </Text>
          <Text variant="body" color="secondary" style={styles.subtitle}>
            All set. Let's turn what you watch into lasting knowledge.
          </Text>
        </Animated.View>

        <View style={styles.bottom}>
          <Button
            variant="primary"
            fullWidth
            onPress={handleContinue}
            loading={isSaving}
          >
            Continue
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
  emojiContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  emoji: {
    fontSize: 64,
    lineHeight: 80,
  },
  title: {
    textAlign: 'center',
    lineHeight: 38,
  },
  subtitle: {
    textAlign: 'center',
    marginTop: spacing.md,
  },
  bottom: {
    marginTop: spacing.xxl,
  },
});
