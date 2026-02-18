/**
 * Notifications Screen - Step 10 (final)
 *
 * Requests push notification permissions.
 * Both "Activer" and "Plus tard" complete onboarding and navigate to main app.
 * Full custom layout (no OnboardingScreen wrapper).
 */

import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Bell } from 'lucide-react-native';
import { Text, Button } from '../../components/ui';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing, borderRadius } from '../../theme';

export default function NotificationsScreen() {
  const router = useRouter();
  const { saveStep, completeOnboarding } = useOnboardingStore();
  const { checkAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const finishOnboarding = async () => {
    setLoading(true);
    try {
      await saveStep(10);
      await completeOnboarding();
      await checkAuth();
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async () => {
    try {
      await Notifications.requestPermissionsAsync();
    } catch {
      // Permission denied or unavailable -- continue regardless
    }
    await finishOnboarding();
  };

  const handleSkip = async () => {
    await finishOnboarding();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Bell size={36} color={colors.accent} />
        </View>

        <Text variant="h2" weight="bold" style={styles.title}>
          Reste au courant
        </Text>

        <Text variant="body" color="secondary" style={styles.subtitle}>
          Active les notifications pour ne jamais oublier de réviser
        </Text>
      </View>

      <View style={styles.footer}>
        <Button
          variant="primary"
          fullWidth
          size="lg"
          onPress={handleEnable}
          disabled={loading}
          loading={loading}
        >
          Activer les notifications
        </Button>

        <Pressable onPress={handleSkip} style={styles.skipBtn} disabled={loading}>
          <Text variant="body" color="secondary" weight="medium">
            Plus tard
          </Text>
        </Pressable>
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
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 165, 116, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: spacing.md,
    alignItems: 'center',
  },
  skipBtn: {
    paddingVertical: spacing.sm,
  },
});
