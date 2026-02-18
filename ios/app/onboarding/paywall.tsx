/**
 * Paywall Screen - Step 11 (conditional)
 * RevenueCat offerings with trial CTA
 */

import { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text, Button } from '../../components/ui';
import { colors, spacing, fonts, borderRadius } from '../../theme';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  isProUser,
} from '../../lib/revenueCat';
import type { PurchasesPackage } from 'react-native-purchases';

export default function PaywallScreen() {
  const router = useRouter();
  const { completeOnboarding } = useOnboardingStore();
  const { checkAuth } = useAuthStore();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    loadOfferings();
  }, []);

  const loadOfferings = async () => {
    try {
      const offerings = await getOfferings();
      const available = offerings?.current?.availablePackages ?? [];
      setPackages(available);
      if (available.length > 0) {
        setSelectedPkg(available[0]);
      }
    } catch {
      // No offerings available
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPkg) return;
    setPurchasing(true);
    try {
      const info = await purchasePackage(selectedPkg);
      if (info && isProUser(info)) {
        await finishOnboarding();
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      const info = await restorePurchases();
      if (info && isProUser(info)) {
        await finishOnboarding();
      }
    } finally {
      setPurchasing(false);
    }
  };

  const finishOnboarding = async () => {
    await completeOnboarding();
    await checkAuth();
    router.replace('/(tabs)');
  };

  const handleSkip = async () => {
    await finishOnboarding();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text
          style={{ fontSize: 48, textAlign: 'center', marginBottom: spacing.md }}
        >
          ✨
        </Text>
        <Text variant="h2" style={styles.title}>
          Débloquer Ankora Pro
        </Text>
        <Text variant="body" color="secondary" style={styles.subtitle}>
          14 jours d'essai gratuit, annule quand tu veux
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : (
          <View style={styles.packages}>
            {packages.map((pkg) => (
              <Pressable
                key={pkg.identifier}
                style={[
                  styles.packageCard,
                  selectedPkg?.identifier === pkg.identifier && styles.packageSelected,
                ]}
                onPress={() => setSelectedPkg(pkg)}
              >
                <Text variant="body" weight="semibold">
                  {pkg.product.title}
                </Text>
                <Text variant="body" color="secondary">
                  {pkg.product.priceString}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.features}>
          {['Quiz illimités', 'Toutes les plateformes', 'Mémos IA avancés', 'Support prioritaire'].map(
            (feature) => (
              <View key={feature} style={styles.featureRow}>
                <Text style={{ color: colors.success, marginRight: spacing.sm }}>✓</Text>
                <Text variant="body">{feature}</Text>
              </View>
            )
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          variant="primary"
          fullWidth
          onPress={handlePurchase}
          loading={purchasing}
          disabled={!selectedPkg || purchasing}
        >
          Essayer gratuitement
        </Button>

        <Pressable onPress={handleRestore} style={styles.restoreBtn} disabled={purchasing}>
          <Text variant="caption" color="muted">
            Restaurer mes achats
          </Text>
        </Pressable>

        <Pressable onPress={handleSkip} style={styles.skipBtn} disabled={purchasing}>
          <Text variant="caption" color="muted">
            Continuer gratuitement
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  packages: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  packageCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  packageSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(212, 165, 116, 0.08)',
  },
  features: {
    gap: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  restoreBtn: {
    padding: spacing.sm,
  },
  skipBtn: {
    padding: spacing.sm,
  },
});
