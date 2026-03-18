/**
 * Profile Tab - User info, OAuth platforms, Settings
 */

import { useState, useRef } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Crown, Wrench, LogOut, CreditCard, RotateCcw, Info } from 'lucide-react-native';
import Constants from 'expo-constants';
import { Text } from '../../components/ui';
import { GlassCard } from '../../components/glass/GlassCard';
import { PlatformIcon } from '../../components/icons';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useAuthStore } from '../../stores/authStore';
import { useOAuthStatus, useSubscription } from '../../hooks';
import { restorePurchases, isRevenueCatAvailable } from '../../lib/purchases';

// OTA-safe: load RevenueCatUI dynamically (native module may not be in binary)
let RevenueCatUI: any = null;
try {
  RevenueCatUI = require('react-native-purchases-ui').default;
} catch {
  // Not available
}
import api from '../../lib/api';
import { colors, spacing, borderRadius, glass, depth } from '../../theme';
import { haptics } from '../../lib/haptics';

const platformConfig = [
  { id: 'youtube', name: 'YouTube' },
  { id: 'spotify', name: 'Spotify' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'instagram', name: 'Instagram' },
] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const { bottom: bottomInset, top: topInset } = useSafeAreaInsets();
  const tabBarHeight = bottomInset + 49;
  const { user, logout } = useAuthStore();
  const { data: oauthStatus, isLoading } = useOAuthStatus();
  const { isProUser } = useSubscription();
  const queryClient = useQueryClient();
  const [loadingPlatform, setLoadingPlatform] = useState<string | null>(null);
  const [restoringPurchases, setRestoringPurchases] = useState(false);

  // Name editing drawer state
  const [showNameDrawer, setShowNameDrawer] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<TextInput>(null);

  // Dev tools state (only in __DEV__)
  const [switchingPlan, setSwitchingPlan] = useState(false);
  const plans = ['FREE', 'PRO', 'LIFETIME'] as const;
  const currentPlan = user?.plan || 'FREE';

  const handleOpenNameDrawer = () => {
    haptics.light();
    setEditedName(user?.name || '');
    setShowNameDrawer(true);
    setTimeout(() => nameInputRef.current?.focus(), 100);
  };

  const handleCloseNameDrawer = () => {
    setShowNameDrawer(false);
    setEditedName('');
  };

  const handleSaveName = async () => {
    const trimmedName = editedName.trim();
    if (!trimmedName || trimmedName === user?.name) {
      handleCloseNameDrawer();
      return;
    }

    setSavingName(true);
    try {
      const { data } = await api.patch('/users/profile', { name: trimmedName });
      useAuthStore.setState((state) => ({
        user: state.user ? { ...state.user, name: data.name } : null,
      }));
      haptics.success();
      handleCloseNameDrawer();
    } catch (error) {
      haptics.error();
      Alert.alert('Erreur', 'Impossible de modifier le nom');
    } finally {
      setSavingName(false);
    }
  };

  const handleSwitchPlan = async (plan: string) => {
    if (plan === currentPlan || switchingPlan) return;
    setSwitchingPlan(true);
    try {
      const { data } = await api.patch('/users/dev/plan', { plan });
      useAuthStore.setState((state) => ({
        user: state.user ? { ...state.user, plan: data.plan } : null,
      }));
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de changer le plan');
    } finally {
      setSwitchingPlan(false);
    }
  };

  const handleManageSubscription = async () => {
    haptics.light();
    if (!RevenueCatUI) {
      Alert.alert('Bientôt disponible', 'La gestion d\'abonnement nécessite une mise à jour de l\'app.');
      return;
    }
    try {
      await RevenueCatUI.presentCustomerCenter();
    } catch (error) {
      console.error('Customer Center error:', error);
    }
  };

  const handleRestorePurchases = async () => {
    haptics.light();
    setRestoringPurchases(true);
    try {
      const info = await restorePurchases();
      if (info) {
        haptics.success();
        Alert.alert('Achats restaurés', 'Vos achats ont été restaurés avec succès.');
      } else {
        Alert.alert('Aucun achat', 'Aucun achat à restaurer.');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de restaurer les achats.');
    } finally {
      setRestoringPurchases(false);
    }
  };

  const handleShowPaywall = async () => {
    haptics.light();
    if (!RevenueCatUI) {
      Alert.alert('Bientôt disponible', 'Les abonnements nécessitent une mise à jour de l\'app.');
      return;
    }
    try {
      await RevenueCatUI.presentPaywall();
    } catch (error) {
      console.error('Paywall error:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Tu veux vraiment te déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: async () => {
            queryClient.cancelQueries();
            queryClient.clear();
            await logout();
          },
        },
      ]
    );
  };

  const refreshOAuthStatus = () => {
    queryClient.invalidateQueries({ queryKey: ['oauth', 'status'] });
  };

  const handleConnect = async (platformId: string) => {
    // Cookie-based platforms use WebView login flow
    if (platformId === 'tiktok' || platformId === 'instagram' || platformId === 'spotify') {
      router.push({ pathname: '/oauth/[platform]', params: { platform: platformId } });
      return;
    }

    setLoadingPlatform(platformId);
    try {
      const { data } = await api.get(`/oauth/${platformId}/connect`, {
        params: {
          client: 'ios',
          appRedirectUri: 'ankora://oauth/callback',
        },
      });
      if (data.authUrl) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.authUrl,
          'ankora://oauth/callback'
        );

        if (result.type === 'success') {
          refreshOAuthStatus();
          queryClient.invalidateQueries({ queryKey: ['content'] });
          queryClient.invalidateQueries({ queryKey: ['inbox'] });
          queryClient.invalidateQueries({ queryKey: ['home'] });
        }
      }
    } catch (error) {
      console.error('OAuth error:', error);
    } finally {
      setLoadingPlatform(null);
    }
  };

  const handleDisconnect = (platformId: string, platformName: string) => {
    Alert.alert(
      'Déconnecter ' + platformName,
      'Voulez-vous vraiment déconnecter ce compte ? Votre contenu importé sera conservé.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: async () => {
            setLoadingPlatform(platformId);
            try {
              await api.delete(`/oauth/${platformId}/disconnect`);
              refreshOAuthStatus();
            } catch (error) {
              console.error('Disconnect error:', error);
              Alert.alert('Erreur', 'Impossible de déconnecter le compte');
            } finally {
              setLoadingPlatform(null);
            }
          },
        },
      ]
    );
  };

  const handlePlatformPress = (platformId: string, platformName: string, isConnected: boolean) => {
    if (loadingPlatform) return;

    // Instagram connected → offer sync (on-device) or disconnect
    if (platformId === 'instagram' && isConnected) {
      Alert.alert(platformName, 'Que voulez-vous faire ?', [
        {
          text: 'Synchroniser',
          onPress: () => router.push('/instagram-sync' as any),
        },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: () => handleDisconnect(platformId, platformName),
        },
        { text: 'Annuler', style: 'cancel' },
      ]);
      return;
    }

    // Instagram not connected → go to on-device sync (login + sync in one flow)
    if (platformId === 'instagram' && !isConnected) {
      router.push('/instagram-sync' as any);
      return;
    }

    if (isConnected) {
      handleDisconnect(platformId, platformName);
    } else {
      handleConnect(platformId);
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  const platforms = platformConfig.map((p) => ({
    ...p,
    status: oauthStatus?.[p.id as keyof typeof oauthStatus] ?? null,
  }));

  // User name fallback chain: name > email prefix > 'Utilisateur'
  const displayName = user?.name || user?.email?.split('@')[0] || 'Utilisateur';
  const initials = displayName.slice(0, 2).toUpperCase();

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1, paddingTop: topInset, backgroundColor: colors.background }}>
    <ScrollView style={styles.scrollView} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.lg }]} showsVerticalScrollIndicator={false}>

      {/* User Header - Avatar, Name, Email */}
      <View style={styles.userHeader}>
        <Pressable onPress={handleOpenNameDrawer}>
          <View style={styles.avatar}>
            <Text variant="h2" style={styles.avatarText}>{initials}</Text>
          </View>
        </Pressable>

        <Pressable onPress={handleOpenNameDrawer}>
          <Text variant="h3" weight="semibold" style={styles.userName}>
            {displayName}
          </Text>
        </Pressable>

        <Text variant="caption" color="secondary" style={styles.userEmail}>
          {user?.email || ''}
        </Text>
      </View>

      {/* Plan Card */}
      <GlassCard padding="md" style={styles.planCard}>
        <Pressable style={styles.planCardContent} onPress={isProUser ? handleManageSubscription : handleShowPaywall}>
          <View style={styles.planIconContainer}>
            <Crown size={20} color={isProUser ? colors.accent : colors.textSecondary} strokeWidth={2} />
          </View>
          <Text variant="body" weight="medium" style={styles.planCardText}>
            {isProUser ? 'Pro' : 'Gratuit'}
          </Text>
          <ChevronRight size={18} color={colors.textSecondary} strokeWidth={1.75} />
        </Pressable>
      </GlassCard>

      {/* Connected Platforms */}
      <GlassCard padding="none" style={styles.card}>
        {platforms.map((platform, index) => {
          const isConnected = platform.status !== null;
          const isPlatformLoading = loadingPlatform === platform.id;
          return (
            <Pressable
              key={platform.id}
              style={[styles.row, index < platforms.length - 1 && styles.rowBorder]}
              onPress={() => handlePlatformPress(platform.id, platform.name, isConnected)}
              disabled={isPlatformLoading}
            >
              <View style={styles.rowIcon}>
                <PlatformIcon platform={platform.id} size={20} colored />
              </View>
              <Text variant="body" style={styles.rowLabel}>
                {platform.name}
              </Text>
              {isPlatformLoading ? (
                <Text variant="caption" style={{ color: colors.text }}>...</Text>
              ) : isConnected ? (
                <View style={styles.connectedBadge}>
                  <View style={styles.connectedDot} />
                </View>
              ) : (
                <View style={styles.connectedBadge}>
                  <View style={styles.disconnectedDot} />
                </View>
              )}
            </Pressable>
          );
        })}
      </GlassCard>

      {/* Settings */}
      <GlassCard padding="none" style={styles.card}>
        <Pressable style={[styles.row, styles.rowBorder]} onPress={handleManageSubscription}>
          <View style={styles.rowIcon}>
            <CreditCard size={20} color={colors.textSecondary} strokeWidth={1.75} />
          </View>
          <Text variant="body" style={styles.rowLabel}>Abonnement</Text>
          <ChevronRight size={18} color={colors.textSecondary} strokeWidth={1.75} />
        </Pressable>
        <Pressable
          style={[styles.row, styles.rowBorder]}
          onPress={handleRestorePurchases}
          disabled={restoringPurchases}
        >
          <View style={styles.rowIcon}>
            <RotateCcw size={20} color={colors.textSecondary} strokeWidth={1.75} />
          </View>
          <Text variant="body" style={styles.rowLabel}>
            {restoringPurchases ? 'Restauration...' : 'Restaurer les achats'}
          </Text>
          <ChevronRight size={18} color={colors.textSecondary} strokeWidth={1.75} />
        </Pressable>
        <Pressable style={styles.row}>
          <View style={styles.rowIcon}>
            <Info size={20} color={colors.textSecondary} strokeWidth={1.75} />
          </View>
          <Text variant="body" style={styles.rowLabel}>À propos</Text>
          <ChevronRight size={18} color={colors.textSecondary} strokeWidth={1.75} />
        </Pressable>
      </GlassCard>

      {/* Logout */}
      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <LogOut size={20} color={colors.textSecondary} strokeWidth={1.75} />
        <Text variant="body" color="secondary" style={styles.logoutLabel}>
          Déconnexion
        </Text>
      </Pressable>

      {/* Version */}
      <Text variant="caption" color="secondary" style={styles.version}>
        Version {appVersion}
      </Text>

      {/* Dev Tools — only in development */}
      {__DEV__ && (
        <View style={styles.devSection}>
          <View style={styles.devHeader}>
            <Wrench size={14} color={colors.textSecondary} strokeWidth={2} />
            <Text variant="caption" color="secondary" style={styles.devTitle}>
              Dev Tools
            </Text>
          </View>
          <GlassCard padding="md">
            <Text variant="caption" color="secondary" style={styles.devLabel}>
              Plan actif (backend)
            </Text>
            <View style={styles.devPlanRow}>
              {plans.map((plan) => (
                <Pressable
                  key={plan}
                  style={[
                    styles.devPlanChip,
                    currentPlan === plan && styles.devPlanChipActive,
                  ]}
                  onPress={() => handleSwitchPlan(plan)}
                  disabled={switchingPlan}
                >
                  <Text
                    variant="caption"
                    weight={currentPlan === plan ? 'medium' : 'regular'}
                    style={currentPlan === plan ? styles.devPlanChipTextActive : styles.devPlanChipText}
                  >
                    {plan}
                  </Text>
                </Pressable>
              ))}
            </View>
          </GlassCard>
        </View>
      )}
    </ScrollView>

      {/* Name Edit Drawer */}
      <Modal
        visible={showNameDrawer}
        transparent
        animationType="slide"
        onRequestClose={handleCloseNameDrawer}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.drawerContainer}
          keyboardVerticalOffset={0}
        >
          {/* Backdrop */}
          <Pressable style={styles.drawerBackdrop} onPress={handleCloseNameDrawer} />

          {/* Sheet */}
          <View style={[styles.drawerSheet, { paddingBottom: spacing.lg }]}>
            {/* Handle bar */}
            <Pressable onPress={handleCloseNameDrawer} hitSlop={20}>
              <View style={styles.drawerHandle} />
            </Pressable>

            <Text variant="h3" weight="semibold" style={styles.drawerTitle}>
              Modifier le nom
            </Text>

            {/* Name input */}
            <TextInput
              ref={nameInputRef}
              style={styles.drawerInput}
              value={editedName}
              onChangeText={setEditedName}
              placeholder="Ton nom"
              placeholderTextColor="rgba(0, 0, 0, 0.4)"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={50}
              editable={!savingName}
              onSubmitEditing={handleSaveName}
              returnKeyType="done"
              selectionColor={colors.accent}
            />

            {/* Save button */}
            <Pressable
              style={({ pressed }) => [
                styles.drawerSaveButton,
                (!editedName.trim() || savingName) && styles.drawerSaveButtonDisabled,
                pressed && editedName.trim() && !savingName && styles.drawerSaveButtonPressed,
              ]}
              onPress={handleSaveName}
              disabled={!editedName.trim() || savingName}
            >
              <Text variant="body" weight="semibold" style={styles.drawerSaveText}>
                {savingName ? 'Enregistrement...' : 'Enregistrer'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  content: { padding: spacing.md },

  // User Header
  userHeader: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    color: '#FFFFFF',
  },
  userName: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  userEmail: {
    textAlign: 'center',
  },

  // Name Edit Drawer
  drawerContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawerSheet: {
    backgroundColor: colors.accent,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  drawerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  drawerTitle: {
    color: colors.background,
    marginBottom: spacing.md,
  },
  drawerInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
    fontSize: 17,
    fontFamily: 'Geist_500Medium',
    color: colors.textDark,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  drawerSaveButton: {
    backgroundColor: colors.background,
    paddingVertical: 16,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  drawerSaveButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  drawerSaveButtonDisabled: {
    opacity: 0.4,
  },
  drawerSaveText: {
    color: '#FFFFFF',
  },

  // Plan Card
  planCard: {
    marginBottom: spacing.md,
  },
  planCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planIconContainer: {
    width: 24,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCardText: {
    flex: 1,
  },

  // Cards
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: glass.border,
  },
  rowIcon: {
    width: 24,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
  },
  connectedBadge: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  disconnectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.textTertiary,
  },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  logoutLabel: {},

  // Version
  version: {
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },

  // Dev Tools
  devSection: {
    marginTop: spacing.md,
  },
  devHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  devTitle: {},
  devLabel: {
    marginBottom: spacing.sm,
  },
  devPlanRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  devPlanChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  devPlanChipActive: {
    backgroundColor: 'rgba(181, 165, 254, 0.15)',
    borderColor: colors.accent,
  },
  devPlanChipText: {
    color: colors.textSecondary,
  },
  devPlanChipTextActive: {
    color: colors.accent,
  },
});
