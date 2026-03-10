/**
 * Onboarding Step 2: First name
 */

import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text, Input, Button } from '../../components/ui';
import { OnboardingProgressBar } from '../../components/onboarding/OnboardingProgressBar';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing } from '../../theme';
import { haptics } from '../../lib/haptics';

export default function NameScreen() {
  const router = useRouter();
  const { saveStep, isSaving } = useOnboardingStore();
  const { updateUser } = useAuthStore();
  const [name, setName] = useState('');

  const handleContinue = async () => {
    if (name.trim().length < 2) return;
    haptics.light();
    try {
      await saveStep(2, { firstName: name.trim() });
      updateUser({ onboardingStep: 2, firstName: name.trim() });
      router.push('/onboarding/interests');
    } catch {
      // Error handled in store
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgressBar step={2} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <Text variant="h2" style={styles.title}>What's your name?</Text>
          <Text variant="body" color="secondary" style={styles.subtitle}>
            We'll personalize your experience.
          </Text>

          <View style={styles.inputWrapper}>
            <Input
              placeholder="Your first name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          <Button
            variant="primary"
            fullWidth
            onPress={handleContinue}
            disabled={name.trim().length < 2}
            loading={isSaving}
          >
            Continue
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  inputWrapper: {
    marginBottom: spacing.xl,
  },
  title: {
    textAlign: 'left',
  },
  subtitle: {
    textAlign: 'left',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
});
