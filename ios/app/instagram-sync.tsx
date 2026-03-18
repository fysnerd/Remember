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

// JS that intercepts fetch/XHR to capture Instagram's own API responses
// when we navigate to the likes page. We don't make our own API calls —
// we just read what Instagram's web app already fetches.
const INTERCEPT_JS = `
(function() {
  if (window.__ankoraIntercepted) return;
  window.__ankoraIntercepted = true;

  function extractAndSend(url, text) {
    // Try JSON parse first (standard API responses)
    try {
      var data = JSON.parse(text);
      if (data.items && data.items.length > 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'INTERCEPTED',
          url: url.substring(0, 200),
          body: JSON.stringify(data)
        }));
        return;
      }
    } catch(e) {}

    // Not JSON (Bloks format) — extract shortcodes via regex
    var codes = [];
    var seen = {};
    // Match "code":"XXXXX" patterns (reel/post shortcodes)
    var re = /["\u0022]code["\u0022]\s*:\s*["\u0022]([A-Za-z0-9_-]{6,})["\u0022]/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      if (!seen[m[1]]) {
        seen[m[1]] = true;
        codes.push(m[1]);
      }
    }
    if (codes.length > 0) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'SHORTCODES',
        url: url.substring(0, 200),
        codes: codes
      }));
    }
  }

  var origFetch = window.fetch;
  window.fetch = async function() {
    var response = await origFetch.apply(this, arguments);
    try {
      var url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] && arguments[0].url ? arguments[0].url : '');
      if (url.indexOf('liked') !== -1) {
        var clone = response.clone();
        var text = await clone.text();
        if (text.indexOf('code') !== -1) {
          extractAndSend(url, text);
        }
      }
    } catch(e) {}
    return response;
  };

  // Also intercept XMLHttpRequest
  var origXHROpen = XMLHttpRequest.prototype.open;
  var origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this.__url = url;
    return origXHROpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    var self = this;
    this.addEventListener('load', function() {
      try {
        var url = self.__url || '';
        if (url.indexOf('liked') !== -1) {
          var text = self.responseText;
          if (text.indexOf('code') !== -1) {
            extractAndSend(url, text);
          }
        }
      } catch(e) {}
    });
    return origXHRSend.apply(this, arguments);
  };

  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DEBUG', msg: 'Interceptors installed' }));
})();
true;
`;

// URL of the Instagram likes page — Instagram's web app will fetch liked items
const LIKES_PAGE_URL = 'https://www.instagram.com/your_activity/interactions/likes/';

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
      // Escape cookie values for safe JS string injection
      const escapeCookieValue = (v: string) =>
        v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/\n/g, '');

      const cookieStatements = Object.entries(storedCookies)
        .filter(([_, v]) => v && typeof v === 'string')
        .map(([k, v]) => {
          const safeVal = escapeCookieValue(String(v));
          return `document.cookie = "${k}=${safeVal}; domain=.instagram.com; path=/; secure";`;
        })
        .join('\n');

      const injectAndFetch = `
        (function() {
          try {
            ${cookieStatements}
            setTimeout(function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'COOKIES_SET' }));
            }, 500);
          } catch(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FETCH_ERROR', error: e.message }));
          }
        })();
        true;
      `;
      webViewRef.current?.injectJavaScript(injectAndFetch);
    }
  }, [state, storedCookies, syncTriggered]);

  // 3. For login mode: check if user has logged in (or was already logged in)
  const checkLoginAndSync = useCallback(async () => {
    if (!CookieManager || syncTriggered) return;
    // Only run in login mode
    if (state !== 'login') return;
    try {
      const cookies = await CookieManager.get('https://www.instagram.com');
      const hasSession = cookies?.sessionid?.value || cookies?.ds_user_id?.value;
      if (hasSession) {
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

        // Trigger the sync — navigate to likes page
        setSyncTriggered(true);
        setState('syncing');
        setMessage('Connecté ! Récupération de vos reels...');
        webViewRef.current?.injectJavaScript(`window.location.href = '${LIKES_PAGE_URL}'; true;`);
      }
    } catch {}
  }, [state, syncTriggered]);

  // Also poll for cookies every 2s in login mode (catches already-logged-in state)
  useEffect(() => {
    if (state !== 'login' || syncTriggered) return;
    const interval = setInterval(() => checkLoginAndSync(), 2000);
    return () => clearInterval(interval);
  }, [state, syncTriggered, checkLoginAndSync]);

  // Timeout: if syncing takes more than 20s, show error
  useEffect(() => {
    if (state !== 'syncing') return;
    const timeout = setTimeout(() => {
      setMessage("La page des likes n'a pas renvoyé de données. Réessayez.");
      setState('error');
    }, 20000);
    return () => clearTimeout(timeout);
  }, [state]);

  // 4. Handle messages from WebView
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === 'DEBUG') {
        console.log('[InstagramSync DEBUG]', msg.msg);
        return;
      }

      if (msg.type === 'COOKIES_SET') {
        // Cookies injected — navigate to likes page (interceptors will capture the data)
        setSyncTriggered(true);
        setState('syncing');
        setMessage('Récupération de vos reels likés...');
        webViewRef.current?.injectJavaScript(`window.location.href = '${LIKES_PAGE_URL}'; true;`);
        return;
      }

      if (msg.type === 'SHORTCODES') {
        const codes: string[] = msg.codes || [];
        console.log(`[InstagramSync] Extracted ${codes.length} shortcodes:`, codes.slice(0, 5));
        if (codes.length > 0) {
          processShortcodes(codes);
        }
        return;
      }

      if (msg.type === 'LIKED_FEED' || msg.type === 'INTERCEPTED') {
        console.log('[InstagramSync] Got data from:', msg.url || 'direct');
        try {
          const data = JSON.parse(msg.body);
          // Instagram web can return items in various structures
          let items = data.items || [];
          // GraphQL responses might nest items differently
          if (items.length === 0 && data.data) {
            // Try common GraphQL response paths
            const nested = data.data?.xdt_api__v1__feed__liked?.items
              || data.data?.liked_by_me?.items
              || [];
            items = nested;
          }
          if (items.length > 0) {
            console.log(`[InstagramSync] Found ${items.length} items, processing...`);
            processItems(items);
          } else {
            console.log('[InstagramSync] Response had no items, body preview:', msg.body?.substring(0, 300));
          }
        } catch (e) {
          console.error('[InstagramSync] Parse error:', e);
        }
        return;
      }

      if (msg.type === 'FETCH_ERROR') {
        console.log('[InstagramSync] Fetch error:', msg.status, msg.error);

        // Auto-sync with injected cookies failed — but the WebView might
        // have its own valid session. Check WebView cookies before giving up.
        if (!syncTriggered || state === 'syncing') {
          setSyncTriggered(false);
          setState('login');
          setMessage('Vérification de votre session...');
          // The poll interval (checkLoginAndSync every 2s) will pick up
          // valid WebView cookies and auto-trigger sync
        }
        return;
      }
    } catch {}
  }, [state, storedCookies]);

  // 5a. Send shortcodes to backend (from Bloks responses)
  const processShortcodes = useCallback(async (codes: string[]) => {
    try {
      const res = await api.post('/content/import-instagram-shortcodes', { shortcodes: codes });
      const count = res.data?.newItems || 0;
      setNewItems(count);

      // Save fresh cookies for transcription
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

  // 5b. Send extracted items to backend (from JSON API responses)
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
            injectedJavaScriptBeforeContentLoaded={INTERCEPT_JS}
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
            injectedJavaScriptBeforeContentLoaded={INTERCEPT_JS}
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
