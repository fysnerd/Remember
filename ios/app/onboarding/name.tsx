/**
 * Onboarding - Name Screen
 *
 * Step 1: Asks the user for their first name.
 * Progress: 0.15
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { OnboardingScreen } from '../../components/onboarding/OnboardingScreen';
import { Input, Button } from '../../components/ui';
import { useOnboardingStore } from '../../stores/onboardingStore';

export default function OnboardingName() {
  const router = useRouter();
  const { firstName, setFirstName } = useOnboardingStore();
  const [name, setName] = useState(firstName);

  const isValid = name.trim().length >= 2;

  const handleContinue = () => {
    setFirstName(name.trim());
    router.push('/onboarding/auth' as any);
  };

  return (
    <OnboardingScreen
      progress={0.15}
      title="Comment tu t'appelles ?"
      showBack={false}
      footer={
        <Button
          fullWidth
          disabled={!isValid}
          onPress={handleContinue}
        >
          Continuer
        </Button>
      }
    >
      <Input
        label="Prenom"
        placeholder="Ton prenom"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
    </OnboardingScreen>
  );
}
