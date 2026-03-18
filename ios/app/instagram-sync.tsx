/**
 * Instagram On-Device Sync Screen
 *
 * Instead of sending cookies to the backend (which calls Instagram from a VPS IP
 * and triggers "suspicious login" warnings), this screen:
 * 1. Opens Instagram in a WebView on the user's device
 * 2. User logs in naturally (same device, same IP)
 * 3. Injected JS intercepts fetch() responses containing liked feed data
 * 4. Extracted items are sent to the backend for content creation + transcription
 *
 * The user's device makes the Instagram requests, so Instagram sees a normal
 * mobile session — no data center IP, no fingerprint mismatch.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useQueryClient } from '@tanstack/react-query';
import { Text, Button } from '../components/ui';
import { LoadingScreen } from '../components/LoadingScreen';
import api from '../lib/api';
import { colors, spacing } from '../theme';

// Dynamic import — requires dev build
let CookieManager: any = null;
try {
  CookieManager = require('@preeternal/react-native-cookie-manager').default;
} catch (e) {
  console.warn('CookieManager not available');
}

// Safari iOS UA to avoid WebView blocks from Instagram
const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// JS injected into the WebView to intercept Instagram API responses
const INJECT_JS = `
(function() {
  if (window.__ankoraInjected) return;
  window.__ankoraInjected = true;

  // Override fetch to intercept Instagram API responses
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
      // Intercept liked feed responses (web or mobile API)
      if (url.includes('feed/liked') || url.includes('liked_by') ||
          (url.includes('graphql') && url.includes('liked'))) {
        const clone = response.clone();
        const text = await clone.text();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'API_RESPONSE',
          url: url,
          body: text
        }));
      }
    } catch(e) {}
    return response;
  };

  // Override XMLHttpRequest for older-style calls
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__url = url;
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      try {
        const url = this.__url || '';
        if (url.includes('feed/liked') || url.includes('liked_by')) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'API_RESPONSE',
            url: url,
            body: this.responseText
          }));
        }
      } catch(e) {}
    });
    return origSend.apply(this, args);
  };

  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'INJECTED' }));
})();
true;
`;

// JS to trigger the liked feed fetch from within the WebView context
const FETCH_LIKED_JS = `
(async function() {
  try {
    // Get CSRF token from cookies
    const csrfMatch = document.cookie.match(/csrftoken=([^;]+)/);
    const csrfToken = csrfMatch ? csrfMatch[1] : '';

    // Try the web API endpoint first
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

type SyncState = 'login' | 'ready' | 'syncing' | 'done' | 'error';

interface SyncResult {
  newItems: number;
  message: string;
}

export default function InstagramSyncScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const webViewRef = useRef<WebView>(null);

  const [state, setState] = useState<SyncState>('login');
  const [isWebViewLoading, setIsWebViewLoading] = useState(true);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check if user is logged in by looking for session cookies
  const checkLoginStatus = useCallback(async () => {
    if (!CookieManager) return;
    try {
      const cookies = await CookieManager.get('https://www.instagram.com');
      const hasSession = cookies?.sessionid?.value || cookies?.ds_user_id?.value;
      if (hasSession && !isLoggedIn) {
        setIsLoggedIn(true);
        setState('ready');
      }
    } catch (e) {
      // Ignore cookie check errors
    }
  }, [isLoggedIn]);

  // Also send cookies to backend for transcription (yt-dlp needs them)
  const saveCookiesForTranscription = useCallback(async () => {
    if (!CookieManager) return;
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
    } catch (e) {
      console.warn('Could not save cookies for transcription:', e);
    }
  }, []);

  // Process items received from the WebView
  const processItems = useCallback(async (items: any[]) => {
    if (!items || items.length === 0) {
      setSyncResult({ newItems: 0, message: 'Aucun nouveau reel trouvé.' });
      setState('done');
      return;
    }

    try {
      // Send extracted items to backend
      const res = await api.post('/content/import-instagram-items', { items });
      const newItems = res.data?.newItems || 0;

      // Also save cookies for transcription pipeline
      await saveCookiesForTranscription();

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['content'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['oauth', 'status'] });

      setSyncResult({
        newItems,
        message: newItems > 0
          ? `${newItems} nouveau${newItems > 1 ? 'x' : ''} reel${newItems > 1 ? 's' : ''} importé${newItems > 1 ? 's' : ''} !`
          : 'Tous vos reels sont déjà synchronisés.',
      });
      setState('done');
    } catch (error) {
      console.error('Import error:', error);
      setSyncResult({ newItems: 0, message: "Erreur lors de l'import." });
      setState('error');
    }
  }, [queryClient, saveCookiesForTranscription]);

  // Handle messages from the WebView
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === 'INJECTED') {
        console.log('[InstagramSync] JS injected successfully');
        return;
      }

      if (msg.type === 'LIKED_FEED' || msg.type === 'API_RESPONSE') {
        try {
          const data = JSON.parse(msg.body);
          const items = data.items || [];
          if (items.length > 0) {
            console.log(`[InstagramSync] Got ${items.length} items from Instagram`);
            processItems(items);
          } else {
            // Might be a GraphQL response with different structure
            console.log('[InstagramSync] Response had no items, checking structure...');
            setSyncResult({ newItems: 0, message: 'Aucun reel liké trouvé.' });
            setState('done');
          }
        } catch (parseErr) {
          console.error('[InstagramSync] Failed to parse response:', parseErr);
          setState('error');
          setSyncResult({ newItems: 0, message: 'Format de réponse inattendu.' });
        }
        return;
      }

      if (msg.type === 'FETCH_ERROR') {
        console.error('[InstagramSync] Fetch error:', msg);
        setState('error');
        setSyncResult({
          newItems: 0,
          message: `Erreur Instagram: ${msg.status || msg.error || 'inconnue'}`,
        });
        return;
      }
    } catch (e) {
      // Not JSON, ignore
    }
  }, [processItems]);

  // Start sync: inject JS to fetch liked feed
  const startSync = useCallback(() => {
    setState('syncing');
    webViewRef.current?.injectJavaScript(FETCH_LIKED_JS);
  }, []);

  if (!CookieManager) {
    return (
      <>
        <Stack.Screen options={{ title: 'Sync Instagram' }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContent}>
            <Text variant="h3" style={styles.centerText}>
              Development Build requis
            </Text>
            <Text variant="body" color="secondary" style={styles.centerText}>
              Nécessite un build avec les modules natifs.
            </Text>
            <Button variant="outline" onPress={() => router.back()}>
              Retour
            </Button>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Sync Instagram',
          headerBackTitle: 'Retour',
        }}
      />
      <SafeAreaView style={styles.container}>
        {/* Instructions */}
        <View style={styles.instructions}>
          <Text variant="body" color="secondary">
            {state === 'login' && "Connectez-vous à Instagram, puis appuyez sur Synchroniser."}
            {state === 'ready' && "Connecté ! Appuyez sur Synchroniser pour importer vos reels likés."}
            {state === 'syncing' && "Récupération de vos reels likés..."}
            {state === 'done' && (syncResult?.message || 'Terminé !')}
            {state === 'error' && (syncResult?.message || 'Une erreur est survenue.')}
          </Text>
          {state === 'done' && (
            <Text variant="caption" color="secondary" style={{ marginTop: spacing.xs }}>
              Astuce : si Instagram vous signale une activité suspecte, allez dans Instagram {'>'} Paramètres {'>'} Sécurité {'>'} Connexions {'>'} "C'est bien moi".
            </Text>
          )}
        </View>

        {/* WebView */}
        <View style={styles.webviewContainer}>
          {isWebViewLoading && (
            <View style={styles.loadingOverlay}>
              <LoadingScreen />
            </View>
          )}
          <WebView
            ref={webViewRef}
            source={{ uri: 'https://www.instagram.com/accounts/login/' }}
            userAgent={USER_AGENT}
            onLoadStart={() => setIsWebViewLoading(true)}
            onLoadEnd={() => {
              setIsWebViewLoading(false);
              checkLoginStatus();
            }}
            onNavigationStateChange={() => checkLoginStatus()}
            injectedJavaScript={INJECT_JS}
            onMessage={onMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            thirdPartyCookiesEnabled={true}
            sharedCookiesEnabled={true}
            incognito={false}
            style={styles.webview}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          {(state === 'login' || state === 'ready') && (
            <Button
              variant="primary"
              fullWidth
              onPress={startSync}
              disabled={state === 'login'}
            >
              {state === 'login' ? 'Connectez-vous d\'abord' : 'Synchroniser mes reels likés'}
            </Button>
          )}
          {state === 'syncing' && (
            <Button variant="primary" fullWidth disabled loading onPress={() => {}}>
              Synchronisation...
            </Button>
          )}
          {(state === 'done' || state === 'error') && (
            <View style={styles.footerRow}>
              <Button
                variant="outline"
                onPress={() => {
                  setState('ready');
                  setSyncResult(null);
                }}
                style={styles.footerButton}
              >
                Relancer
              </Button>
              <Button
                variant="primary"
                onPress={() => router.back()}
                style={styles.footerButton}
              >
                Terminé
              </Button>
            </View>
          )}
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
  centerContent: {
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
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  footerButton: {
    flex: 1,
  },
});
