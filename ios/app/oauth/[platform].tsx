/**
 * OAuth WebView Screen - For TikTok/Instagram cookie-based auth
 * Requires development build (not Expo Go) for CookieManager
 */

import { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useQueryClient } from '@tanstack/react-query';
import { Text, Button } from '../../components/ui';
import { LoadingScreen } from '../../components/LoadingScreen';
import api from '../../lib/api';
import { colors, spacing } from '../../theme';

// Dynamic import to handle case where native module isn't available
let CookieManager: any = null;
try {
  CookieManager = require('@preeternal/react-native-cookie-manager').default;
} catch (e) {
  console.warn('CookieManager not available - requires development build');
}

type Platform = 'tiktok' | 'instagram';

const PLATFORM_CONFIG: Record<Platform, { name: string; loginUrl: string; domain: string }> = {
  tiktok: {
    name: 'TikTok',
    loginUrl: 'https://www.tiktok.com/login',
    domain: 'https://www.tiktok.com',
  },
  instagram: {
    name: 'Instagram',
    loginUrl: 'https://www.instagram.com/accounts/login/',
    domain: 'https://www.instagram.com',
  },
};

// Safari iOS user agent to avoid WebView blocks
const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

export default function OAuthWebViewScreen() {
  const { platform } = useLocalSearchParams<{ platform: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const webViewRef = useRef<WebView>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [cookiesCleared, setCookiesCleared] = useState(false);

  const platformKey = platform as Platform;
  const config = PLATFORM_CONFIG[platformKey];

  // Clear old cookies on mount so the user gets a fresh login page
  useEffect(() => {
    if (CookieManager && config) {
      CookieManager.clearAll()
        .then(() => {
          console.log(`[OAuth] Cleared cookies for fresh ${config.name} login`);
          setCookiesCleared(true);
        })
        .catch(() => setCookiesCleared(true));
    } else {
      setCookiesCleared(true);
    }
  }, []);

  if (!config) {
    return (
      <SafeAreaView style={styles.container}>
        <Text variant="body">Plateforme non supportée</Text>
        <Button variant="outline" onPress={() => router.back()}>
          Retour
        </Button>
      </SafeAreaView>
    );
  }

  // Check if CookieManager is available (requires dev build)
  if (!CookieManager) {
    return (
      <>
        <Stack.Screen options={{ title: `Connexion ${config.name}` }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <Text variant="h3" style={styles.errorTitle}>
              Development Build requis
            </Text>
            <Text variant="body" color="secondary" style={styles.errorText}>
              La connexion à {config.name} nécessite un development build avec les modules natifs.
            </Text>
            <Text variant="caption" color="secondary" style={styles.errorHint}>
              Lance: npx expo run:ios
            </Text>
            <Button variant="outline" onPress={() => router.back()}>
              Retour
            </Button>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const extractAndSaveCookies = async () => {
    setIsExtracting(true);
    try {
      // Get all cookies for the domain using native CookieManager
      const cookies = await CookieManager.get(config.domain);

      // Format cookies as key-value pairs
      const formattedCookies: Record<string, string> = {};
      for (const [name, cookie] of Object.entries(cookies)) {
        if (cookie && typeof cookie === 'object' && 'value' in cookie) {
          formattedCookies[name] = (cookie as { value: string }).value;
        } else if (cookie && typeof cookie === 'string') {
          formattedCookies[name] = cookie;
        }
      }

      // Check for required session cookies
      const hasTikTokSession =
        formattedCookies.sessionid || formattedCookies.msToken || formattedCookies.tt_webid;
      const hasInstagramSession =
        formattedCookies.sessionid || (formattedCookies.csrftoken && formattedCookies.ds_user_id);

      const hasSession = platformKey === 'tiktok' ? hasTikTokSession : hasInstagramSession;

      if (!hasSession) {
        Alert.alert(
          'Non connecté',
          `Veuillez d'abord vous connecter à ${config.name}, puis appuyer sur "Valider la connexion".`
        );
        setIsExtracting(false);
        return;
      }

      // Send cookies to backend (send directly, not wrapped in { cookies: ... })
      await api.post(`/oauth/${platformKey}/connect`, formattedCookies);

      // Refresh OAuth status
      queryClient.invalidateQueries({ queryKey: ['oauth', 'status'] });

      Alert.alert('Succès', `${config.name} connecté avec succès !`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Cookie extraction error:', error);
      Alert.alert('Erreur', "Impossible de valider la connexion. Réessayez.");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: `Connexion ${config.name}`,
          headerBackTitle: 'Annuler',
        }}
      />
      <SafeAreaView style={styles.container}>
        <View style={styles.instructions}>
          <Text variant="body" color="secondary">
            Connectez-vous à {config.name}, puis appuyez sur le bouton ci-dessous.
          </Text>
        </View>

        <View style={styles.webviewContainer}>
          {(isLoading || !cookiesCleared) && (
            <View style={styles.loadingOverlay}>
              <LoadingScreen />
            </View>
          )}
          {cookiesCleared && (
            <WebView
              ref={webViewRef}
              source={{ uri: config.loginUrl }}
              userAgent={USER_AGENT}
              onLoadStart={() => setIsLoading(true)}
              onLoadEnd={() => setIsLoading(false)}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              thirdPartyCookiesEnabled={true}
              sharedCookiesEnabled={true}
              incognito={false}
              style={styles.webview}
            />
          )}
        </View>

        <View style={styles.footer}>
          <Button
            variant="primary"
            fullWidth
            onPress={extractAndSaveCookies}
            loading={isExtracting}
            disabled={isExtracting}
          >
            Valider la connexion
          </Button>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  errorText: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  errorHint: {
    fontFamily: 'monospace',
    marginBottom: spacing.xl,
  },
  instructions: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    backgroundColor: colors.background,
  },
  webview: {
    flex: 1,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
