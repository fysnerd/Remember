/**
 * Source Connection Screen - Step 6
 *
 * Connect a content source (YouTube, Spotify, TikTok, Instagram).
 * YouTube/Spotify use expo-web-browser OAuth flow.
 * TikTok/Instagram navigate to the WebView-based cookie auth screen.
 * This step is skippable via "Plus tard".
 */

import { useState } from 'react';
import { View, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { OnboardingScreen } from '../../components/onboarding/OnboardingScreen';
import { Text } from '../../components/ui';
import { useOnboardingStore } from '../../stores/onboardingStore';
import api from '../../lib/api';
import { colors, spacing, borderRadius, fonts } from '../../theme';

interface PlatformConfig {
  id: string;
  name: string;
  color: string;
  emoji: string;
  type: 'oauth' | 'cookies';
}

const PLATFORMS: PlatformConfig[] = [
  { id: 'youtube', name: 'YouTube', color: '#FF0000', emoji: '▶', type: 'oauth' },
  { id: 'spotify', name: 'Spotify', color: '#1DB954', emoji: '♫', type: 'oauth' },
  { id: 'tiktok', name: 'TikTok', color: '#FFFFFF', emoji: '♪', type: 'cookies' },
  { id: 'instagram', name: 'Instagram', color: '#E1306C', emoji: '📷', type: 'cookies' },
];

export default function SourceScreen() {
  const router = useRouter();
  const { saveStep } = useOnboardingStore();
  const [loadingPlatform, setLoadingPlatform] = useState<string | null>(null);

  const handleConnect = async (platform: PlatformConfig) => {
    if (loadingPlatform) return;

    if (platform.type === 'cookies') {
      // Navigate to the WebView-based cookie auth screen
      router.push(`/oauth/${platform.id}`);
      return;
    }

    // OAuth flow via expo-web-browser
    setLoadingPlatform(platform.id);
    try {
      const { data } = await api.get(`/oauth/${platform.id}/connect`, {
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
          await saveStep(6, { connectedSource: platform.id });
          router.push('/onboarding/attribution' as any);
          return;
        }
      }
    } catch (error) {
      console.error('OAuth connect error:', error);
      Alert.alert('Erreur', `Impossible de connecter ${platform.name}. Réessaie plus tard.`);
    } finally {
      setLoadingPlatform(null);
    }
  };

  const handleSkip = async () => {
    await saveStep(6);
    router.push('/onboarding/attribution' as any);
  };

  return (
    <OnboardingScreen
      progress={0.70}
      title="Connecte une source"
      subtitle="On importera ton contenu automatiquement"
      showBack
      onBack={() => router.back()}
      footer={
        <Pressable onPress={handleSkip} style={styles.skipBtn}>
          <Text variant="body" color="secondary" weight="medium">
            Plus tard
          </Text>
        </Pressable>
      }
    >
      <View style={styles.list}>
        {PLATFORMS.map((platform) => (
          <Pressable
            key={platform.id}
            onPress={() => handleConnect(platform)}
            disabled={!!loadingPlatform}
            style={({ pressed }) => [
              styles.platformCard,
              pressed && styles.platformCardPressed,
              loadingPlatform === platform.id && styles.platformCardLoading,
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: `${platform.color}20` }]}>
              <Text style={[styles.iconEmoji, { color: platform.color }]}>
                {platform.emoji}
              </Text>
            </View>
            <View style={styles.platformText}>
              <Text variant="body" weight="semibold">
                {platform.name}
              </Text>
              <Text variant="caption" color="secondary">
                Connecter mon compte
              </Text>
            </View>
            <Text variant="caption" color="secondary" style={styles.arrow}>
              →
            </Text>
          </Pressable>
        ))}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  platformCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  platformCardPressed: {
    opacity: 0.85,
  },
  platformCardLoading: {
    opacity: 0.6,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 20,
  },
  platformText: {
    flex: 1,
    gap: 2,
  },
  arrow: {
    fontSize: 18,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
});
