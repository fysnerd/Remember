/**
 * Onboarding Step 5: Quiz frequency (single-select cards)
 */

import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text, Button } from '../../components/ui';
import { OnboardingProgressBar } from '../../components/onboarding/OnboardingProgressBar';
import { SelectCard } from '../../components/onboarding/SelectCard';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing } from '../../theme';
import { haptics } from '../../lib/haptics';

const FREQUENCY_OPTIONS = [
  { value: 'relaxed', emoji: '🌿', label: '1-2 par semaine', description: 'Tranquille, à ton rythme' },
  { value: 'regular', emoji: '⚡', label: '3-4 par semaine', description: 'Un bon rythme régulier' },
  { value: 'daily', emoji: '🔥', label: 'Tous les jours', description: 'Mode intensif' },
];

export default function FrequencyScreen() {
  const router = useRouter();
  const { saveStep, isSaving } = useOnboardingStore();
  const { updateUser } = useAuthStore();
  const [selected, setSelected] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!selected) return;
    haptics.light();
    try {
      await saveStep(5, { quizFrequency: selected });
      updateUser({ onboardingStep: 5 });
      router.push('/onboarding/connect');
    } catch {
      // Error handled in store
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgressBar step={5} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="h2">À quel rythme ?</Text>
        <Text variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
          Tu pourras changer ça plus tard.
        </Text>

        <View style={styles.cards}>
          {FREQUENCY_OPTIONS.map((freq) => (
            <SelectCard
              key={freq.value}
              emoji={freq.emoji}
              label={freq.label}
              description={freq.description}
              selected={selected === freq.value}
              onPress={() => setSelected(freq.value)}
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
          Continuer
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
  cards: {
    gap: spacing.md,
    marginVertical: spacing.xl,
  },
});
