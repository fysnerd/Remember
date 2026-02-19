/**
 * Onboarding Step 3: Interests (multi-select chips, min 2)
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

const INTEREST_OPTIONS = [
  'Science', 'Technologie', 'Business', 'Philosophie',
  'Histoire', 'Psychologie', 'Santé', 'Finance',
  'Art & Design', 'Politique', 'Dev personnel', 'Sport',
  'Musique', 'Cinéma', 'Cuisine', 'Langues',
];

export default function InterestsScreen() {
  const router = useRouter();
  const { saveStep, isSaving } = useOnboardingStore();
  const { updateUser } = useAuthStore();
  const [selected, setSelected] = useState<string[]>([]);

  const toggleInterest = (interest: string) => {
    setSelected((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const handleContinue = async () => {
    if (selected.length < 2) return;
    haptics.light();
    try {
      await saveStep(3, { interests: selected });
      updateUser({ onboardingStep: 3 });
      router.push('/onboarding/goals');
    } catch {
      // Error handled in store
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgressBar step={3} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="h2">Qu'est-ce qui t'intéresse ?</Text>
        <Text variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
          Choisis au moins 2 sujets.
        </Text>

        <View style={styles.chips}>
          {INTEREST_OPTIONS.map((interest) => (
            <SelectChip
              key={interest}
              label={interest}
              selected={selected.includes(interest)}
              onPress={() => toggleInterest(interest)}
            />
          ))}
        </View>

        <Button
          variant="primary"
          fullWidth
          onPress={handleContinue}
          disabled={selected.length < 2}
          loading={isSaving}
        >
          Continuer ({selected.length} sélectionné{selected.length > 1 ? 's' : ''})
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
    marginVertical: spacing.xl,
  },
});
