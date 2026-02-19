/**
 * Onboarding Step 4: Goals (single-select cards)
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

const GOAL_OPTIONS = [
  { value: 'culture', emoji: '🌍', label: 'Élargir ma culture générale' },
  { value: 'exam', emoji: '📝', label: 'Préparer un examen / concours' },
  { value: 'skills', emoji: '🚀', label: 'Apprendre de nouvelles compétences' },
  { value: 'curiosity', emoji: '🔍', label: 'Simple curiosité' },
];

export default function GoalsScreen() {
  const router = useRouter();
  const { saveStep, isSaving } = useOnboardingStore();
  const { updateUser } = useAuthStore();
  const [selected, setSelected] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!selected) return;
    haptics.light();
    try {
      await saveStep(4, { goal: selected });
      updateUser({ onboardingStep: 4 });
      router.push('/onboarding/frequency');
    } catch {
      // Error handled in store
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgressBar step={4} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="h2">Quel est ton objectif ?</Text>
        <Text variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
          On adaptera les quiz pour toi.
        </Text>

        <View style={styles.cards}>
          {GOAL_OPTIONS.map((goal) => (
            <SelectCard
              key={goal.value}
              emoji={goal.emoji}
              label={goal.label}
              selected={selected === goal.value}
              onPress={() => setSelected(goal.value)}
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
