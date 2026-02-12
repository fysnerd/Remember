/**
 * Profile Tab - User info, OAuth platforms, Settings
 *
 * Glass UI rebuild: GlassCard for all sections, user name fallback chain,
 * platform connect/disconnect with full OAuth flow preserved.
 */

import { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { User, ChevronRight, Wrench } from 'lucide-react-native';
import { Text, Button } from '../../components/ui';
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
  const [syncingPlatform, setSyncingPlatform] = useState<string | null>(null);

  // DEV: Trigger manual sync for a specific platform
  const handleSync = async (platform: string, label: string) => {
    setSyncingPlatform(platform);
    try {
      await api.post(`/admin/sync/${platform}`);
      Alert.alert('Sync lance', `Le sync ${label} a ete declenche. Les nouveaux contenus apparaitront bientot.`);
      queryClient.invalidateQueries({ queryKey: ['content'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Erreur', `Impossible de lancer le sync ${label}`);
    } finally {
      setSyncingPlatform(null);
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
      // TikTok/Instagram: WebView avec extraction de cookies
      router.push({ pathname: '/oauth/[platform]', params: { platform: platformId } });
      return;
    }

    // YouTube/Spotify: OAuth classique via WebBrowser
    setLoadingPlatform(platformId);
    try {
      const { data } = await api.get(`/oauth/${platformId}/connect`, {
        params: {
          client: 'ios',
          appRedirectUri: 'ankora://oauth/callback',
        },
      });
      if (data.authUrl) {
        // Use openAuthSessionAsync to properly handle the deep link redirect
        const result = await WebBrowser.openAuthSessionAsync(
          data.authUrl,
          'ankora://oauth/callback'
        );

        if (result.type === 'success') {
          // OAuth completed, refresh status
          refreshOAuthStatus();
        } else if (result.type === 'cancel') {
          console.log('OAuth cancelled by user');
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
    if (loadingPlatform) return; // Prevent multiple taps
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.lg }]}>
      {/* User Info */}
      <GlassCard padding="lg" style={styles.userCard}>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <User size={28} color={colors.textSecondary} strokeWidth={1.75} />
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

      {/* DEV Tools - Remove in production */}
      <View style={styles.section}>
        <View style={styles.devTitleRow}>
          <Wrench size={16} color={colors.error} strokeWidth={1.75} />
          <Text variant="h3" style={[styles.sectionTitle, { color: colors.error, marginBottom: 0 }]}>
            Dev Tools (beta)
          </Text>
        </View>
        <GlassCard padding="md">
          <Pressable
            style={styles.foundationTestButton}
            onPress={() => router.push('/dev-test' as any)}
          >
            <Text variant="body" weight="medium">
              Foundation Test
            </Text>
            <Text variant="caption" color="secondary">
              Validate BlurView, Lucide, Geist
            </Text>
          </Pressable>
          <View style={styles.syncGrid}>
            {([
              { id: 'youtube', label: 'YouTube' },
              { id: 'spotify', label: 'Spotify' },
              { id: 'tiktok', label: 'TikTok' },
              { id: 'instagram', label: 'Instagram' },
            ] as const).map((p) => (
              <Pressable
                key={p.id}
                style={[styles.syncButton, syncingPlatform === p.id && styles.syncButtonDisabled]}
                onPress={() => handleSync(p.id, p.label)}
                disabled={syncingPlatform !== null}
              >
                <View style={styles.syncButtonContent}>
                  <PlatformIcon platform={p.id} size={14} colored />
                  <Text variant="body" weight="medium" style={styles.syncButtonText}>
                    {p.label}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
          <Text variant="caption" color="secondary" style={styles.syncHint}>
            Sync individuel par plateforme
          </Text>
        </GlassCard>
      </View>
    </ScrollView>
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
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  userInfo: { flex: 1 },
  planBadge: { marginTop: spacing.xs },
  section: { marginBottom: spacing.xl },
  sectionTitle: { marginBottom: spacing.md },
  devTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
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
  foundationTestButton: {
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  syncGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  syncButton: {
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    width: '48%' as any,
  },
  syncButtonDisabled: {
    opacity: 0.5,
  },
  syncButtonContent: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs },
  syncButtonText: { color: colors.text },
  syncHint: { marginTop: spacing.sm, textAlign: 'center' },
});
