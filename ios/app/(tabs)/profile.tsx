/**
 * Profile Tab - User info, OAuth platforms, Settings
 */

import { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import { useBottomTabBarHeight } from 'react-native-bottom-tabs';
import { ChevronRight, Wrench } from 'lucide-react-native';
import { Text } from '../../components/ui';
import { GlassCard } from '../../components/glass/GlassCard';
import { PlatformIcon } from '../../components/icons';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useAuthStore } from '../../stores/authStore';
import { useOAuthStatus } from '../../hooks';
import api from '../../lib/api';
import { colors, spacing, borderRadius, glass } from '../../theme';

const platformConfig = [
  { id: 'youtube', name: 'YouTube' },
  { id: 'spotify', name: 'Spotify' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'instagram', name: 'Instagram' },
] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { user, logout } = useAuthStore();
  const { data: oauthStatus, isLoading } = useOAuthStatus();
  const queryClient = useQueryClient();
  const [loadingPlatform, setLoadingPlatform] = useState<string | null>(null);
  const [switchingPlan, setSwitchingPlan] = useState(false);

  const plans = ['FREE', 'PRO', 'LIFETIME'] as const;
  const currentPlan = user?.plan || 'FREE';

  const handleSwitchPlan = async (plan: string) => {
    if (plan === currentPlan || switchingPlan) return;
    setSwitchingPlan(true);
    try {
      const { data } = await api.patch('/users/dev/plan', { plan });
      // Update local auth store with new plan
      useAuthStore.setState((state) => ({
        user: state.user ? { ...state.user, plan: data.plan } : null,
      }));
      // Invalidate subscription cache so all screens re-read the plan
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de changer le plan');
    } finally {
      setSwitchingPlan(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const refreshOAuthStatus = () => {
    queryClient.invalidateQueries({ queryKey: ['oauth', 'status'] });
  };

  const handleConnect = async (platformId: string) => {
    if (platformId === 'tiktok' || platformId === 'instagram') {
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
      'Deconnecter ' + platformName,
      'Voulez-vous vraiment deconnecter ce compte ? Votre contenu importe sera conserve.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Deconnecter',
          style: 'destructive',
          onPress: async () => {
            setLoadingPlatform(platformId);
            try {
              await api.delete(`/oauth/${platformId}/disconnect`);
              refreshOAuthStatus();
            } catch (error) {
              console.error('Disconnect error:', error);
              Alert.alert('Erreur', 'Impossible de deconnecter le compte');
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

  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1 }}>
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.lg }]}>
      {/* User Info */}
      <GlassCard padding="lg" style={styles.userCard}>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text variant="h3" style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text variant="body" weight="medium">
              {displayName}
            </Text>
            <Text variant="caption" color="secondary">
              {user?.email || ''}
            </Text>
            <Text variant="label" color="secondary" style={styles.planBadge}>
              {user?.plan || 'FREE'}
            </Text>
          </View>
        </View>
      </GlassCard>

      {/* Connected Platforms */}
      <View style={styles.section}>
        <Text variant="h3" style={styles.sectionTitle}>
          Plateformes connectees
        </Text>
        <GlassCard padding="none">
          {platforms.map((platform, index) => {
            const isConnected = platform.status !== null;
            const isPlatformLoading = loadingPlatform === platform.id;
            return (
              <Pressable
                key={platform.id}
                style={[styles.platformRow, index < platforms.length - 1 && styles.platformBorder]}
                onPress={() => handlePlatformPress(platform.id, platform.name, isConnected)}
                disabled={isPlatformLoading}
              >
                <View style={styles.platformIcon}>
                  <PlatformIcon platform={platform.id} size={20} colored />
                </View>
                <Text variant="body" style={styles.platformName}>
                  {platform.name}
                </Text>
                {isPlatformLoading ? (
                  <Text variant="caption" color="secondary">
                    ...
                  </Text>
                ) : isConnected ? (
                  <Text variant="caption" weight="medium" style={styles.disconnectText}>
                    Deconnecter
                  </Text>
                ) : (
                  <Text variant="caption" color="secondary">
                    Connecter
                  </Text>
                )}
              </Pressable>
            );
          })}
        </GlassCard>
      </View>

      {/* Settings */}
      <View style={styles.section}>
        <Text variant="h3" style={styles.sectionTitle}>
          Parametres
        </Text>
        <GlassCard padding="none">
          <Pressable style={[styles.settingsRow, styles.platformBorder]}>
            <Text variant="body">A propos</Text>
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={1.75} />
          </Pressable>
          <Pressable style={styles.settingsRow} onPress={handleLogout}>
            <Text variant="body" style={styles.logoutText}>
              Deconnexion
            </Text>
          </Pressable>
        </GlassCard>
      </View>
      {/* Dev Tools */}
      <View style={styles.section}>
        <View style={styles.devHeader}>
          <Wrench size={14} color={colors.textSecondary} strokeWidth={2} />
          <Text variant="h3" color="secondary" style={styles.devTitle}>
            Dev Tools
          </Text>
        </View>
        <GlassCard padding="md">
          <Text variant="caption" color="secondary" style={styles.devLabel}>
            Plan actif
          </Text>
          <View style={styles.planRow}>
            {plans.map((plan) => (
              <Pressable
                key={plan}
                style={[
                  styles.planChip,
                  currentPlan === plan && styles.planChipActive,
                ]}
                onPress={() => handleSwitchPlan(plan)}
                disabled={switchingPlan}
              >
                <Text
                  variant="caption"
                  weight={currentPlan === plan ? 'medium' : 'regular'}
                  style={currentPlan === plan ? styles.planChipTextActive : styles.planChipText}
                >
                  {plan}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>
      </View>
    </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  userCard: { marginBottom: spacing.xl },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: '#FFFFFF',
  },
  userInfo: { flex: 1 },
  planBadge: { marginTop: spacing.xs },
  section: { marginBottom: spacing.xl },
  sectionTitle: { marginBottom: spacing.md },
  platformRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  platformBorder: { borderBottomWidth: 1, borderBottomColor: glass.border },
  platformIcon: { marginRight: spacing.md },
  platformName: { flex: 1 },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  logoutText: { color: colors.error },
  disconnectText: { color: colors.error },
  devHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  devTitle: { fontSize: 15 },
  devLabel: { marginBottom: spacing.sm },
  planRow: { flexDirection: 'row', gap: spacing.sm },
  planChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  planChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: colors.accent,
  },
  planChipText: { color: colors.textSecondary },
  planChipTextActive: { color: colors.accent },
});
