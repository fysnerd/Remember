/**
 * Onboarding Step 6: Connect sources (YouTube, Spotify, TikTok, Instagram)
 * Uses the same OAuth flows as the profile screen.
 */

import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import { Text, Button } from '../../components/ui';
import { PlatformIcon } from '../../components/icons';
import { OnboardingProgressBar } from '../../components/onboarding/OnboardingProgressBar';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { useOAuthStatus } from '../../hooks';
import api from '../../lib/api';
import { colors, spacing, borderRadius, glass } from '../../theme';
import { haptics } from '../../lib/haptics';

const platformConfig = [
  { id: 'youtube', name: 'YouTube' },
  { id: 'spotify', name: 'Spotify' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'instagram', name: 'Instagram' },
] as const;

export default function ConnectScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { saveStep, isSaving } = useOnboardingStore();
  const { updateUser } = useAuthStore();
  const { data: oauthStatus } = useOAuthStatus();
  const [loadingPlatform, setLoadingPlatform] = useState<string | null>(null);

  const refreshOAuthStatus = () => {
    queryClient.invalidateQueries({ queryKey: ['oauth', 'status'] });
  };

  const handleConnect = useCallback(async (platformId: string) => {
    haptics.light();

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
  }, []);

  const handleContinue = async () => {
    haptics.light();
    try {
      await saveStep(6);
      updateUser({ onboardingStep: 6 });
      router.push('/onboarding/attribution');
    } catch {
      // Error handled in store
    }
  };

  const platforms = platformConfig.map((p) => ({
    ...p,
    status: oauthStatus?.[p.id as keyof typeof oauthStatus] ?? null,
  }));

  const connectedCount = platforms.filter((p) => p.status !== null).length;

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgressBar step={6} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="h2">Connecte tes sources</Text>
        <Text variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
          On importera le contenu que tu regardes pour creer des quiz.
        </Text>

        <View style={styles.platforms}>
          {platforms.map((platform, index) => {
            const isConnected = platform.status !== null;
            const isPlatformLoading = loadingPlatform === platform.id;

            return (
              <Pressable
                key={platform.id}
                onPress={() => handleConnect(platform.id)}
                disabled={isConnected || isPlatformLoading}
                style={[
                  styles.platformRow,
                  index < platforms.length - 1 && styles.platformBorder,
                  isConnected && styles.platformConnected,
                ]}
              >
                <View style={styles.platformIcon}>
                  <PlatformIcon platform={platform.id} size={20} colored />
                </View>
                <Text variant="body" style={styles.platformName}>
                  {platform.name}
                </Text>
                {isPlatformLoading ? (
                  <Text variant="caption" color="secondary">...</Text>
                ) : isConnected ? (
                  <Text variant="caption" weight="medium" style={{ color: colors.success }}>
                    Connecte
                  </Text>
                ) : (
                  <Text variant="caption" color="secondary">
                    Connecter
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <Button
          variant="primary"
          fullWidth
          onPress={handleContinue}
          loading={isSaving}
        >
          Continuer
        </Button>

        {connectedCount === 0 && (
          <Pressable onPress={handleContinue} style={{ marginTop: spacing.md }}>
            <Text variant="caption" color="secondary" style={{ textAlign: 'center' }}>
              Passer cette etape
            </Text>
          </Pressable>
        )}
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
  platforms: {
    marginVertical: spacing.xl,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  platformBorder: {
    borderBottomWidth: 1,
    borderBottomColor: glass.border,
  },
  platformConnected: {
    backgroundColor: 'rgba(34, 197, 94, 0.05)',
  },
  platformIcon: {
    marginRight: spacing.md,
  },
  platformName: {
    flex: 1,
  },
});
