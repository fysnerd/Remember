/**
 * Onboarding Step 4: Goals (single-select cards)
 */

import { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, Button } from '../../components/ui';
import { OnboardingProgressBar } from '../../components/onboarding/OnboardingProgressBar';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing, borderRadius, feedback } from '../../theme';
import { haptics } from '../../lib/haptics';

const GOAL_OPTIONS = [
  { value: 'remember', emoji: '🧠', labelKey: 'onboarding.goals.remember' },
  { value: 'learn', emoji: '📚', labelKey: 'onboarding.goals.learn' },
  { value: 'grow', emoji: '💡', labelKey: 'onboarding.goals.grow' },
  { value: 'productive', emoji: '⚡', labelKey: 'onboarding.goals.productive' },
];

export default function GoalsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { saveStep, isSaving } = useOnboardingStore();
  const { updateUser } = useAuthStore();
  const [selected, setSelected] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!selected) return;
    haptics.light();
    try {
      await saveStep(4, { goal: selected });
    } catch {
      // Continue anyway if save fails
    }
    updateUser({ onboardingStep: 4 });
    router.push('/onboarding/frequency');
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgressBar step={4} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="h2" style={styles.title}>{t('onboarding.whatsYourGoal')}</Text>
        <Text variant="body" color="secondary" style={styles.subtitle}>
          {t('onboarding.tailorQuizzes')}
        </Text>

        <View style={styles.grid}>
          {GOAL_OPTIONS.map((goal) => (
            <Pressable
              key={goal.value}
              onPress={() => {
                haptics.selection();
                setSelected(goal.value);
              }}
              style={[styles.gridCard, selected === goal.value && styles.gridCardSelected]}
            >
              <Text style={styles.emoji}>{goal.emoji}</Text>
              <Text
                variant="body"
                weight="medium"
                style={[styles.label, selected === goal.value && styles.labelSelected]}
              >
                {t(goal.labelKey)}
              </Text>
            </Pressable>
          ))}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  gridCard: {
    width: '47%',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  gridCardSelected: {
    borderColor: colors.accent,
    backgroundColor: feedback.selected.background,
  },
  emoji: {
    fontSize: 40,
    lineHeight: 50,
  },
  label: {
    textAlign: 'center',
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
