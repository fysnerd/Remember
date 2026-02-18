/**
 * Objective Screen - Step 4
 *
 * Single-select goal: studies, work, general knowledge, or curiosity.
 * Stores selection in onboardingStore and persists via saveStep.
 */

import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { GraduationCap, Briefcase, BookOpen, Sparkles } from 'lucide-react-native';
import { OnboardingScreen } from '../../components/onboarding/OnboardingScreen';
import { SelectCard } from '../../components/onboarding/SelectCard';
import { Button } from '../../components/ui';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { colors, spacing } from '../../theme';

const OBJECTIVES = [
  {
    value: 'studies',
    label: 'Études',
    subtitle: 'Réviser mes cours et examens',
    Icon: GraduationCap,
  },
  {
    value: 'work',
    label: 'Travail',
    subtitle: 'Monter en compétences pro',
    Icon: Briefcase,
  },
  {
    value: 'general',
    label: 'Culture générale',
    subtitle: 'Apprendre un peu de tout',
    Icon: BookOpen,
  },
  {
    value: 'curiosity',
    label: 'Curiosité',
    subtitle: 'Explorer ce qui m\'intéresse',
    Icon: Sparkles,
  },
] as const;

export default function ObjectiveScreen() {
  const router = useRouter();
  const { objective, setObjective, saveStep, isSubmitting } = useOnboardingStore();

  const handleContinue = async () => {
    await saveStep(4, { objective });
    router.push('/onboarding/pace' as any);
  };

  return (
    <OnboardingScreen
      progress={0.45}
      title="Quel est ton objectif ?"
      showBack
      onBack={() => router.back()}
      footer={
        <Button
          variant="primary"
          fullWidth
          onPress={handleContinue}
          disabled={!objective || isSubmitting}
          loading={isSubmitting}
        >
          Continuer
        </Button>
      }
    >
      <View style={styles.list}>
        {OBJECTIVES.map(({ value, label, subtitle, Icon }) => (
          <SelectCard
            key={value}
            icon={<Icon size={22} color={colors.accent} />}
            label={label}
            subtitle={subtitle}
            selected={objective === value}
            onPress={() => setObjective(value)}
          />
        ))}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
});
