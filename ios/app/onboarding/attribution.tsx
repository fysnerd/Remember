/**
 * Onboarding Step 7: Attribution - How did you hear about Ankora?
 */

import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text, Button } from '../../components/ui';
import { OnboardingProgressBar } from '../../components/onboarding/OnboardingProgressBar';
import { SelectChip } from '../../components/onboarding/SelectChip';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing } from '../../theme';
import { haptics } from '../../lib/haptics';

const ATTRIBUTION_OPTIONS = [
  { label: 'TikTok / Instagram', value: 'social_media' },
  { label: 'Friend / Word of mouth', value: 'friend' },
  { label: 'App Store', value: 'appstore' },
  { label: 'Twitter / X', value: 'twitter' },
  { label: 'Other', value: 'other' },
];

export default function AttributionScreen() {
  const router = useRouter();
  const { saveStep, isSaving } = useOnboardingStore();
  const { updateUser } = useAuthStore();
  const [selected, setSelected] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!selected) return;
    haptics.light();
    try {
      await saveStep(7, { attributionSource: selected });
      updateUser({ onboardingStep: 7 });
      router.push('/onboarding/welcome');
    } catch {
      // Error handled in store
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgressBar step={7} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="h2" style={styles.title}>How did you hear about Ankora?</Text>
        <Text variant="body" color="secondary" style={styles.subtitle}>
          This helps us improve.
        </Text>

        <View style={styles.chips}>
          {ATTRIBUTION_OPTIONS.map((option) => (
            <SelectChip
              key={option.value}
              label={option.label}
              selected={selected === option.value}
              onPress={() => setSelected(option.value)}
            />
          ))}
        </View>

        <Button
          variant="primary"
          fullWidth
          onPress={handleContinue}
          disabled={!selected}
          loading={isSaving}
        >
          Continue
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
