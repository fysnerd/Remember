/**
 * Onboarding Step 5: Quiz frequency (single-select cards)
 */

import { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, Button } from '../../components/ui';
import { OnboardingProgressBar } from '../../components/onboarding/OnboardingProgressBar';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing, borderRadius, feedback } from '../../theme';
import { haptics } from '../../lib/haptics';

const FREQUENCY_OPTIONS = [
  { value: 'daily', labelKey: 'onboarding.frequencyOptions.daily', descKey: 'onboarding.frequencyOptions.dailyDesc' },
  { value: 'regular', labelKey: 'onboarding.frequencyOptions.regular', descKey: 'onboarding.frequencyOptions.regularDesc' },
  { value: 'relaxed', labelKey: 'onboarding.frequencyOptions.relaxed', descKey: 'onboarding.frequencyOptions.relaxedDesc' },
];

export default function FrequencyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { saveStep, isSaving } = useOnboardingStore();
  const { updateUser } = useAuthStore();
  const [selected, setSelected] = useState<string | null>('daily');

  const handleContinue = async () => {
    if (!selected) return;
    haptics.light();
    try {
      await saveStep(5, { quizFrequency: selected });
    } catch {
      // Continue anyway if save fails
    }
    updateUser({ onboardingStep: 5 });
    router.push('/onboarding/connect');
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgressBar step={5} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="h2" style={styles.title}>{t('onboarding.howOften')}</Text>
        <Text variant="body" color="secondary" style={styles.subtitle}>
          {t('onboarding.changeLater')}
        </Text>

        <View style={styles.options}>
          {FREQUENCY_OPTIONS.map((freq) => {
            const isSelected = selected === freq.value;
            return (
              <TouchableOpacity
                key={freq.value}
                onPress={() => {
                  haptics.selection();
                  setSelected(freq.value);
                }}
                activeOpacity={0.7}
                style={[
                  styles.option,
                  isSelected && styles.optionSelected,
                ]}
              >
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
                <View style={styles.optionContent}>
                  <Text variant="body" weight="medium" style={isSelected && styles.labelSelected}>
                    {t(freq.labelKey)}
                  </Text>
                  <Text variant="caption" color="secondary">
                    {t(freq.descKey)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Button
          variant="primary"
          fullWidth
          onPress={handleContinue}
          disabled={!selected}
          loading={isSaving}
        >
          {t('common.continue')}
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
  options: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 72,
  },
  optionSelected: {
    borderColor: colors.accent,
    backgroundColor: feedback.selected.background,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioSelected: {
    borderColor: colors.accent,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  optionContent: {
    flex: 1,
    gap: spacing.xxs,
  },
  labelSelected: {
    color: colors.accent,
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
