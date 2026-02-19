/**
 * Onboarding Step 6: Connect sources (YouTube, Spotify, TikTok, Instagram)
 * Reuses existing OAuth flows. Optional step.
 */

import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import { Text, Button } from '../../components/ui';
import { OnboardingProgressBar } from '../../components/onboarding/OnboardingProgressBar';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { API_URL } from '../../lib/constants';
import { getAccessToken } from '../../lib/storage';
import { colors, spacing, borderRadius } from '../../theme';
import { haptics } from '../../lib/haptics';

interface PlatformConfig {
  key: string;
  name: string;
  emoji: string;
  color: string;
  type: 'oauth' | 'cookie';
}

const PLATFORMS: PlatformConfig[] = [
  { key: 'youtube', name: 'YouTube', emoji: '▶️', color: '#FF0000', type: 'oauth' },
  { key: 'spotify', name: 'Spotify', emoji: '🎵', color: '#1DB954', type: 'oauth' },
  { key: 'tiktok', name: 'TikTok', emoji: '🎬', color: '#000000', type: 'cookie' },
  { key: 'instagram', name: 'Instagram', emoji: '📸', color: '#E4405F', type: 'cookie' },
];

export default function ConnectScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { saveStep, isSaving } = useOnboardingStore();
  const { updateUser } = useAuthStore();
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = useCallback(async (platform: PlatformConfig) => {
    haptics.light();
    setConnecting(platform.key);

    try {
      if (platform.type === 'oauth') {
        // OAuth flow via web browser
        const token = await getAccessToken();
        const url = `${API_URL}/oauth/${platform.key}/connect?token=${token}`;
        await WebBrowser.openBrowserAsync(url);
        // Assume success after browser closes
        setConnected((prev) => new Set(prev).add(platform.key));
        queryClient.invalidateQueries({ queryKey: ['oauth-status'] });
      } else {
        // Cookie-based flow via WebView
        router.push(`/oauth/${platform.key}` as any);
      }
    } catch {
      // User cancelled
    } finally {
      setConnecting(null);
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

  const handleSkip = async () => {
    haptics.light();
    try {
      await saveStep(6);
      updateUser({ onboardingStep: 6 });
      router.push('/onboarding/attribution');
    } catch {
      // Error handled in store
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgressBar step={6} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="h2">Connecte tes sources</Text>
        <Text variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
          On importera le contenu que tu regardes pour créer des quiz.
        </Text>

        <View style={styles.platforms}>
          {PLATFORMS.map((platform) => {
            const isConnected = connected.has(platform.key);
            const isConnecting = connecting === platform.key;

            return (
              <Pressable
                key={platform.key}
                onPress={() => handleConnect(platform)}
                disabled={isConnected || isConnecting}
                style={[styles.platformCard, isConnected && styles.platformConnected]}
              >
                <Text variant="h3" style={{ fontSize: 28 }}>{platform.emoji}</Text>
                <View style={styles.platformInfo}>
                  <Text variant="body" weight="medium">{platform.name}</Text>
                  {isConnected && (
                    <Text variant="caption" style={{ color: colors.success }}>Connecté</Text>
                  )}
                </View>
                {!isConnected && (
                  <Text variant="caption" weight="medium" style={{ color: colors.accent }}>
                    {isConnecting ? '...' : 'Connecter'}
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

        {connected.size === 0 && (
          <Pressable onPress={handleSkip} style={{ marginTop: spacing.md }}>
            <Text variant="caption" color="secondary" style={{ textAlign: 'center' }}>
              Passer cette étape
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
    gap: spacing.md,
    marginVertical: spacing.xl,
  },
  platformCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  platformConnected: {
    borderColor: colors.success,
    backgroundColor: 'rgba(34, 197, 94, 0.05)',
  },
  platformInfo: {
    flex: 1,
    gap: 2,
  },
});
