/**
 * Profile Tab - User info, OAuth platforms, Settings
 */

import { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import { Text, Card, Button } from '../../components/ui';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useAuthStore } from '../../stores/authStore';
import { useOAuthStatus } from '../../hooks';
import api from '../../lib/api';
import { colors, spacing, borderRadius } from '../../theme';

const platformConfig = [
  { id: 'youtube', name: 'YouTube', emoji: '🎬' },
  { id: 'spotify', name: 'Spotify', emoji: '🎧' },
  { id: 'tiktok', name: 'TikTok', emoji: '📱' },
  { id: 'instagram', name: 'Instagram', emoji: '📷' },
] as const;

export default function ProfileScreen() {
  const router = useRouter();
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
      Alert.alert('Sync lancé', `Le sync ${label} a été déclenché. Les nouveaux contenus apparaîtront bientôt.`);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Info */}
      <Card padding="lg" style={styles.userCard}>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text variant="h1">👤</Text>
          </View>
          <View style={styles.userInfo}>
            <Text variant="body" weight="medium">
              {user?.email || 'user@example.com'}
            </Text>
            <Text variant="caption" color="secondary">
              Plan: {user?.plan || 'FREE'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Connected Platforms */}
      <View style={styles.section}>
        <Text variant="h3" style={styles.sectionTitle}>
          Plateformes connectées
        </Text>
        <Card padding="none">
          {platforms.map((platform, index) => {
            const isConnected = platform.status !== null;
            const isLoading = loadingPlatform === platform.id;
            return (
              <Pressable
                key={platform.id}
                style={[styles.platformRow, index < platforms.length - 1 && styles.platformBorder]}
                onPress={() => handlePlatformPress(platform.id, platform.name, isConnected)}
                disabled={isLoading}
              >
                <Text variant="body" style={styles.platformEmoji}>
                  {platform.emoji}
                </Text>
                <Text variant="body" style={styles.platformName}>
                  {platform.name}
                </Text>
                {isLoading ? (
                  <Text variant="caption" color="secondary">
                    ...
                  </Text>
                ) : isConnected ? (
                  <Text variant="caption" weight="medium" style={styles.disconnectText}>
                    Déconnecter
                  </Text>
                ) : (
                  <Text variant="caption" color="secondary">
                    Connecter
                  </Text>
                )}
              </Pressable>
            );
          })}
        </Card>
      </View>

      {/* Settings */}
      <View style={styles.section}>
        <Text variant="h3" style={styles.sectionTitle}>
          Paramètres
        </Text>
        <Card padding="none">
          <Pressable style={[styles.settingsRow, styles.platformBorder]}>
            <Text variant="body">À propos</Text>
            <Text variant="body" color="secondary">
              ›
            </Text>
          </Pressable>
          <Pressable style={styles.settingsRow} onPress={handleLogout}>
            <Text variant="body" style={styles.logoutText}>
              Déconnexion
            </Text>
          </Pressable>
        </Card>
      </View>

      {/* DEV Tools - Remove in production */}
      <View style={styles.section}>
        <Text variant="h3" style={[styles.sectionTitle, { color: 'red' }]}>
          🛠️ Dev Tools (beta)
        </Text>
        <Card padding="md">
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
              { id: 'youtube', label: 'YouTube', emoji: '🎬' },
              { id: 'spotify', label: 'Spotify', emoji: '🎧' },
              { id: 'tiktok', label: 'TikTok', emoji: '📱' },
              { id: 'instagram', label: 'Instagram', emoji: '📷' },
            ] as const).map((p) => (
              <Pressable
                key={p.id}
                style={[styles.syncButton, syncingPlatform === p.id && styles.syncButtonDisabled]}
                onPress={() => handleSync(p.id, p.label)}
                disabled={syncingPlatform !== null}
              >
                <Text variant="body" weight="medium" style={styles.syncButtonText}>
                  {syncingPlatform === p.id ? '⏳' : p.emoji} {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text variant="caption" color="secondary" style={styles.syncHint}>
            Sync individuel par plateforme
          </Text>
        </Card>
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
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  userInfo: { flex: 1 },
  section: { marginBottom: spacing.xl },
  sectionTitle: { marginBottom: spacing.md },
  platformRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  platformBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  platformEmoji: { fontSize: 20, marginRight: spacing.md },
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
  syncButtonText: { color: colors.text },
  syncHint: { marginTop: spacing.sm, textAlign: 'center' },
});
