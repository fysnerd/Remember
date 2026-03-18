/**
 * Instagram On-Device Sync Screen
 *
 * Two modes:
 * 1. ALREADY CONNECTED: Fetch stored cookies from backend → inject into WebView
 *    → auto-fetch feed/liked → send items to backend. No login needed.
 * 2. FIRST TIME: User logs into Instagram in WebView → cookies saved →
 *    auto-fetch feed/liked → send items to backend.
 *
 * All Instagram API calls happen FROM THE USER'S DEVICE (their IP, their
 * Safari WebView), not from our VPS. This avoids "suspicious login" warnings.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useQueryClient } from '@tanstack/react-query';
import { Text, Button } from '../components/ui';
import api from '../lib/api';
import { colors, spacing } from '../theme';

// Dynamic import — requires dev build
let CookieManager: any = null;
try {
  CookieManager = require('@preeternal/react-native-cookie-manager').default;
} catch (e) {
  console.warn('CookieManager not available');
}

// Safari iOS UA
const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// JS to fetch liked feed from within the WebView's authenticated context
const FETCH_LIKED_JS = `
(async function() {
  try {
    const csrfMatch = document.cookie.match(/csrftoken=([^;]+)/);
    const csrfToken = csrfMatch ? csrfMatch[1] : '';

    const res = await fetch('/api/v1/feed/liked/', {
      credentials: 'include',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': csrfToken,
        'X-IG-App-ID': '936619743392459',
        'Accept': '*/*',
      }
    });

    if (res.ok) {
      const text = await res.text();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'LIKED_FEED',
        body: text
      }));
    } else {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'FETCH_ERROR',
        status: res.status,
        statusText: res.statusText
      }));
    }
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'FETCH_ERROR',
      error: e.message
    }));
  }
})();
true;
`;

type SyncState =
  | 'loading'    // Fetching stored cookies from backend
  | 'login'      // No cookies — user needs to log in
  | 'injecting'  // Injecting cookies into WebView
  | 'syncing'    // Fetching liked feed
  | 'done'       // Success
  | 'error';     // Failed

export default function InstagramSyncScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const webViewRef = useRef<WebView>(null);

  const [state, setState] = useState<SyncState>('loading');
  const [message, setMessage] = useState('');
  const [newItems, setNewItems] = useState(0);
  const [storedCookies, setStoredCookies] = useState<Record<string, string> | null>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const [syncTriggered, setSyncTriggered] = useState(false);

  // 1. On mount: try to fetch stored cookies from backend
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/oauth/instagram/cookies');
        if (data.cookies?.sessionid) {
          setStoredCookies(data.cookies);
          setState('injecting');
        } else {
          setState('login');
        }
      } catch {
        setState('login');
      }
    })();
  }, []);

  // 2. When WebView loads and we have cookies → inject them then fetch
  const onWebViewLoad = useCallback(() => {
    setWebViewReady(true);

    if (state === 'injecting' && storedCookies && !syncTriggered) {
      // Inject cookies into WebView via JS
      const cookieStatements = Object.entries(storedCookies)
        .filter(([_, v]) => v && typeof v === 'string')
        .map(([k, v]) => `document.cookie = "${k}=${v}; domain=.instagram.com; path=/; secure";`)
        .join('\n');

      const injectAndFetch = `
        (function() {
          ${cookieStatements}
          // Small delay to let cookies settle, then fetch
          setTimeout(function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'COOKIES_SET' }));
          }, 500);
        })();
        true;
      `;
      webViewRef.current?.injectJavaScript(injectAndFetch);
    }
  }, [state, storedCookies, syncTriggered]);

  // 3. For login mode: check if user has logged in
  const checkLoginAndSync = useCallback(async () => {
    if (state !== 'login' || !CookieManager) return;
    try {
      const cookies = await CookieManager.get('https://www.instagram.com');
      const hasSession = cookies?.sessionid?.value || cookies?.ds_user_id?.value;
      if (hasSession && !syncTriggered) {
        // Save cookies to backend for transcription
        const formatted: Record<string, string> = {};
        for (const [name, cookie] of Object.entries(cookies)) {
          if (cookie && typeof cookie === 'object' && 'value' in cookie) {
            formatted[name] = (cookie as { value: string }).value;
          }
        }
        if (formatted.sessionid) {
          api.post('/oauth/instagram/connect', formatted).catch(() => {});
        }

        // Now trigger the sync
        setSyncTriggered(true);
        setState('syncing');
        setMessage('Connecté ! Récupération de vos reels...');
        webViewRef.current?.injectJavaScript(FETCH_LIKED_JS);
      }
    } catch {}
  }, [state, syncTriggered]);

  // 4. Handle messages from WebView
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === 'COOKIES_SET') {
        // Cookies injected — now fetch liked feed
        setSyncTriggered(true);
        setState('syncing');
        setMessage('Récupération de vos reels likés...');
        webViewRef.current?.injectJavaScript(FETCH_LIKED_JS);
        return;
      }

      if (msg.type === 'LIKED_FEED') {
        try {
          const data = JSON.parse(msg.body);
          const items = data.items || [];
          if (items.length > 0) {
            processItems(items);
          } else {
            setMessage('Aucun reel liké trouvé.');
            setState('done');
          }
        } catch {
          setMessage('Format de réponse inattendu.');
          setState('error');
        }
        return;
      }

      if (msg.type === 'FETCH_ERROR') {
        // If auto-sync failed (expired cookies), fall back to login mode
        if (state === 'syncing' && storedCookies) {
          setState('login');
          setMessage('Session expirée. Reconnectez-vous.');
          setSyncTriggered(false);
          // Clear cookies so WebView shows login page
          CookieManager?.clearAll?.().catch(() => {});
        } else {
          setMessage(`Erreur: ${msg.status || msg.error || 'inconnue'}`);
          setState('error');
        }
        return;
      }
    } catch {}
  }, [state, storedCookies]);

  // 5. Send extracted items to backend
  const processItems = useCallback(async (items: any[]) => {
    try {
      const res = await api.post('/content/import-instagram-items', { items });
      const count = res.data?.newItems || 0;
      setNewItems(count);

      // Also save fresh cookies from WebView for transcription
      if (CookieManager) {
        try {
          const cookies = await CookieManager.get('https://www.instagram.com');
          const formatted: Record<string, string> = {};
          for (const [name, cookie] of Object.entries(cookies)) {
            if (cookie && typeof cookie === 'object' && 'value' in cookie) {
              formatted[name] = (cookie as { value: string }).value;
            }
          }
          if (formatted.sessionid) {
            await api.post('/oauth/instagram/connect', formatted);
          }
        } catch {}
      }

      queryClient.invalidateQueries({ queryKey: ['content'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['oauth', 'status'] });

      setMessage(
        count > 0
          ? `${count} nouveau${count > 1 ? 'x' : ''} reel${count > 1 ? 's' : ''} importé${count > 1 ? 's' : ''} !`
          : 'Tout est déjà synchronisé.'
      );
      setState('done');
    } catch {
      setMessage("Erreur lors de l'import.");
      setState('error');
    }
  }, [queryClient]);

  // --- No CookieManager fallback ---
  if (!CookieManager) {
    return (
      <>
        <Stack.Screen options={{ title: 'Sync Instagram' }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.center}>
            <Text variant="h3" style={styles.centerText}>Development Build requis</Text>
            <Button variant="outline" onPress={() => router.back()}>Retour</Button>
          </View>
        </SafeAreaView>
      </>
    );
  }

  // --- Loading stored cookies ---
  if (state === 'loading') {
    return (
      <>
        <Stack.Screen options={{ title: 'Sync Instagram' }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text variant="body" color="secondary" style={{ marginTop: spacing.md }}>
              Préparation...
            </Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  // --- Syncing / Injecting (WebView hidden or minimal) ---
  if (state === 'injecting' || state === 'syncing') {
    return (
      <>
        <Stack.Screen options={{ title: 'Sync Instagram' }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text variant="body" color="secondary" style={{ marginTop: spacing.md }}>
              {message || 'Synchronisation en cours...'}
            </Text>
          </View>

          {/* Hidden WebView that does the actual work */}
          <WebView
            ref={webViewRef}
            source={{ uri: 'https://www.instagram.com/' }}
            userAgent={USER_AGENT}
            onLoadEnd={onWebViewLoad}
            onMessage={onMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            thirdPartyCookiesEnabled={true}
            sharedCookiesEnabled={true}
            incognito={false}
            style={{ height: 0, opacity: 0 }}
          />
        </SafeAreaView>
      </>
    );
  }

  // --- Done / Error ---
  if (state === 'done' || state === 'error') {
    return (
      <>
        <Stack.Screen options={{ title: 'Sync Instagram' }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.center}>
            <Text variant="h2" style={styles.centerText}>
              {state === 'done' ? (newItems > 0 ? '🎉' : '✅') : '⚠️'}
            </Text>
            <Text variant="h3" style={styles.centerText}>{message}</Text>
            {state === 'done' && (
              <Text variant="caption" color="secondary" style={[styles.centerText, { marginTop: spacing.sm }]}>
                Astuce : si Instagram signale une activité suspecte, confirmez dans Instagram {'>'} Paramètres {'>'} "C'est bien moi".
              </Text>
            )}
            <View style={styles.buttonRow}>
              <Button
                variant="outline"
                onPress={() => {
                  setState('loading');
                  setSyncTriggered(false);
                  setWebViewReady(false);
                  // Re-trigger the flow
                  (async () => {
                    try {
                      const { data } = await api.get('/oauth/instagram/cookies');
                      if (data.cookies?.sessionid) {
                        setStoredCookies(data.cookies);
                        setState('injecting');
                      } else {
                        setState('login');
                      }
                    } catch {
                      setState('login');
                    }
                  })();
                }}
                style={styles.btn}
              >
                Relancer
              </Button>
              <Button variant="primary" onPress={() => router.back()} style={styles.btn}>
                Terminé
              </Button>
            </View>
          </View>
        </SafeAreaView>
      </>
    );
  }

  // --- Login mode: show WebView for user to log in ---
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Connexion Instagram',
          headerBackTitle: 'Retour',
        }}
      />
      <SafeAreaView style={styles.container}>
        <View style={styles.instructions}>
          <Text variant="body" color="secondary">
            {message || "Connectez-vous à Instagram. La synchronisation démarrera automatiquement."}
          </Text>
        </View>

        <View style={styles.webviewContainer}>
          <WebView
            ref={webViewRef}
            source={{ uri: 'https://www.instagram.com/accounts/login/' }}
            userAgent={USER_AGENT}
            onLoadEnd={() => checkLoginAndSync()}
            onNavigationStateChange={() => checkLoginAndSync()}
            onMessage={onMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            thirdPartyCookiesEnabled={true}
            sharedCookiesEnabled={true}
            incognito={false}
            style={styles.webview}
          />
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  centerText: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  instructions: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  btn: {
    flex: 1,
  },
});
