/**
 * Onboarding - Interests Screen
 *
 * Step 3: Multi-select interest topics (minimum 3).
 * Progress: 0.35
 */

import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { OnboardingScreen } from '../../components/onboarding/OnboardingScreen';
import { OnboardingChip } from '../../components/onboarding/OnboardingChip';
import { Button } from '../../components/ui';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { spacing } from '../../theme';

const INTEREST_OPTIONS = [
  'Tech & IA',
  'Science',
  'Histoire',
  'Finance',
  'Psychologie',
  'Philosophie',
  'Sante',
  'Business',
  'Art & Design',
  'Musique',
  'Sport',
  'Politique',
  'Environnement',
  'Langues',
  'Cuisine',
  'Voyage',
] as const;

export default function OnboardingInterests() {
  const router = useRouter();
  const { interests: storedInterests, setInterests, saveStep, isSubmitting } =
    useOnboardingStore();
  const [selected, setSelected] = useState<string[]>(storedInterests);

  const toggleInterest = (interest: string) => {
    setSelected((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const isValid = selected.length >= 3;

  const handleContinue = async () => {
    setInterests(selected);
    await saveStep(3, { interests: selected });
    router.push('/onboarding/objective' as any);
  };

  return (
    <OnboardingScreen
      progress={0.35}
      title="Qu'est-ce qui t'interesse ?"
      subtitle="Choisis au moins 3 sujets"
      showBack
      onBack={() => router.back()}
      footer={
        <Button
          fullWidth
          disabled={!isValid}
          loading={isSubmitting}
          onPress={handleContinue}
        >
          Continuer
        </Button>
      }
    >
      <View style={styles.chips}>
        {INTEREST_OPTIONS.map((interest) => (
          <OnboardingChip
            key={interest}
            label={interest}
            selected={selected.includes(interest)}
            onPress={() => toggleInterest(interest)}
          />
        ))}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
