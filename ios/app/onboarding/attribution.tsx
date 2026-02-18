/**
 * Attribution Screen - Step 7
 *
 * Multi-select chips: how the user discovered Ankora.
 * At least 1 selection required before continuing.
 */

import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { OnboardingScreen } from '../../components/onboarding/OnboardingScreen';
import { OnboardingChip } from '../../components/onboarding/OnboardingChip';
import { Button } from '../../components/ui';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { spacing } from '../../theme';

const SOURCES = [
  'TikTok',
  'Instagram',
  'YouTube',
  'Ami / bouche-à-oreille',
  'App Store',
  'Twitter / X',
  'Autre',
];

export default function AttributionScreen() {
  const router = useRouter();
  const { attributionSources, setAttributionSources, saveStep, isSubmitting } =
    useOnboardingStore();

  const toggleSource = (source: string) => {
    if (attributionSources.includes(source)) {
      setAttributionSources(attributionSources.filter((s) => s !== source));
    } else {
      setAttributionSources([...attributionSources, source]);
    }
  };

  const handleContinue = async () => {
    await saveStep(7, { attributionSource: attributionSources });
    router.push('/onboarding/welcome' as any);
  };

  return (
    <OnboardingScreen
      progress={0.85}
      title="Comment as-tu découvert Ankora ?"
      showBack
      onBack={() => router.back()}
      footer={
        <Button
          variant="primary"
          fullWidth
          onPress={handleContinue}
          disabled={attributionSources.length === 0 || isSubmitting}
          loading={isSubmitting}
        >
          Continuer
        </Button>
      }
    >
      <View style={styles.chips}>
        {SOURCES.map((source) => (
          <OnboardingChip
            key={source}
            label={source}
            selected={attributionSources.includes(source)}
            onPress={() => toggleSource(source)}
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
    gap: spacing.md,
  },
});
