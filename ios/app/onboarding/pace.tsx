/**
 * Pace Screen - Step 5
 *
 * Single-select review frequency: relaxed, regular, dedicated, or intensive.
 * Stores selection in onboardingStore and persists via saveStep.
 */

import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Clock, Target, Flame, Zap } from 'lucide-react-native';
import { OnboardingScreen } from '../../components/onboarding/OnboardingScreen';
import { SelectCard } from '../../components/onboarding/SelectCard';
import { Button } from '../../components/ui';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { colors, spacing } from '../../theme';

const PACES = [
  {
    value: '1-2/sem',
    label: 'Décontracté',
    subtitle: '1-2 fois par semaine',
    Icon: Clock,
  },
  {
    value: '3-5/sem',
    label: 'Régulier',
    subtitle: '3-5 fois par semaine',
    Icon: Target,
  },
  {
    value: '1/jour',
    label: 'Assidu',
    subtitle: 'Tous les jours',
    Icon: Flame,
  },
  {
    value: 'plusieurs/jour',
    label: 'Intensif',
    subtitle: 'Plusieurs fois par jour',
    Icon: Zap,
  },
] as const;

export default function PaceScreen() {
  const router = useRouter();
  const { reviewPace, setReviewPace, saveStep, isSubmitting } = useOnboardingStore();

  const handleContinue = async () => {
    await saveStep(5, { reviewPace });
    router.push('/onboarding/source' as any);
  };

  return (
    <OnboardingScreen
      progress={0.55}
      title="À quel rythme veux-tu réviser ?"
      showBack
      onBack={() => router.back()}
      footer={
        <Button
          variant="primary"
          fullWidth
          onPress={handleContinue}
          disabled={!reviewPace || isSubmitting}
          loading={isSubmitting}
        >
          Continuer
        </Button>
      }
    >
      <View style={styles.list}>
        {PACES.map(({ value, label, subtitle, Icon }) => (
          <SelectCard
            key={value}
            icon={<Icon size={22} color={colors.accent} />}
            label={label}
            subtitle={subtitle}
            selected={reviewPace === value}
            onPress={() => setReviewPace(value)}
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
