/**
 * Instagram On-Device Sync Screen
 *
 * Strategy: DOM scraping (not network interception)
 * 1. Phase 1: WebView loads instagram.com — detect if user is logged in
 * 2. Phase 2: Remount WebView on the likes page URL
 * 3. Injected JS scrapes <a href="/reel/XXX/"> and <a href="/p/XXX/"> from the DOM
 * 4. Auto-scrolls to load more, then sends shortcodes to backend
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

let CookieManager: any = null;
try {
  CookieManager = require('@preeternal/react-native-cookie-manager').default;
} catch (e) {
  console.warn('CookieManager not available');
}

const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const LIKES_PAGE_URL = 'https://www.instagram.com/your_activity/interactions/likes/';

// JS injected into the likes page to scrape shortcodes from the DOM.
// Waits for content to render, scrapes links, auto-scrolls once for more,
// then sends all found shortcodes to native.
const SCRAPE_JS = `
(function() {
  // Convert Instagram media PK (BigInt) to shortcode
  function pkToShortcode(pkStr) {
    var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    var id = BigInt(pkStr);
    var code = '';
    while (id > 0n) {
      code = ALPHABET[Number(id % 64n)] + code;
      id = id / 64n;
    }
    return code;
  }

  function scrapeItems() {
    var items = [];
    var seen = {};

    // Extract ig_cache_key from image URLs (base64-encoded media PKs)
    // Each img is inside a role="button" div — the img src IS the thumbnail
    var imgs = document.querySelectorAll('img[src*="ig_cache_key"]');
    for (var i = 0; i < imgs.length; i++) {
      var src = imgs[i].getAttribute('src') || '';
      var match = src.match(/ig_cache_key=([A-Za-z0-9+/=%-]+)/);
      if (match) {
        try {
          var b64 = decodeURIComponent(match[1]).split('.')[0];
          var pk = atob(b64);
          if (/^\\d+$/.test(pk)) {
            var shortcode = pkToShortcode(pk);
            if (shortcode && !seen[shortcode]) {
              seen[shortcode] = true;
              // Get higher-res thumbnail by replacing s240x240 with s640x640
              var thumbUrl = src.replace(/s240x240/, 's640x640').replace(/&amp;/g, '&');
              items.push({ code: shortcode, pk: pk, thumbnailUrl: thumbUrl });
            }
          }
        } catch(e) {}
      }
    }

    return items;
  }

  function sendResults(items, phase) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'SCRAPED',
      items: items,
      phase: phase,
      url: location.href
    }));
  }

  function sendDebug(msg) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'DEBUG',
      msg: msg
    }));
  }

  // Wait for the page to be ready, then scrape
  var attempts = 0;
  var maxAttempts = 15; // 15 x 1s = 15s max wait

  function tryScape() {
    attempts++;
    var scraped = scrapeItems();
    var codes = scraped;

    // Debug: log sample items found
    if (attempts === 3 && codes.length > 0) {
      sendDebug('Sample items: ' + JSON.stringify(codes.slice(0, 3)));
    }

    sendDebug('Attempt ' + attempts + ': found ' + codes.length + ' codes, URL=' + location.href);

    if (codes.length > 0) {
      // Found some — scroll down for more, then scrape again
      sendDebug('Scrolling for more...');
      window.scrollTo(0, document.body.scrollHeight);
      setTimeout(function() {
        var moreItems = scrapeItems();
        sendDebug('After scroll: ' + moreItems.length + ' items total');
        sendResults(moreItems, 'final');
      }, 3000);
    } else if (attempts < maxAttempts) {
      // Not found yet — page might still be loading
      setTimeout(tryScape, 1000);
    } else {
      // Give up
      sendDebug('No codes found after ' + maxAttempts + ' attempts');
      sendResults([], 'empty');
    }
  }

  // Start scraping after a short delay to let the page render
  setTimeout(tryScape, 2000);
})();
true;
`;

type Phase = 'login' | 'likes' | 'done' | 'error';

export default function InstagramSyncScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>('login');
  const [message, setMessage] = useState('');
  const [newItems, setNewItems] = useState(0);
  const [syncTriggered, setSyncTriggered] = useState(false);

  // Poll for login cookies — when found, switch to likes phase
  const checkLogin = useCallback(async () => {
    if (!CookieManager || syncTriggered) return;
    try {
      const cookies = await CookieManager.get('https://www.instagram.com');
      const hasSession = cookies?.sessionid?.value || cookies?.ds_user_id?.value;
      if (hasSession) {
        console.log('[InstagramSync] Session detected, switching to likes page');
        setSyncTriggered(true);

        // Save cookies to backend for transcription (yt-dlp)
        const formatted: Record<string, string> = {};
        for (const [name, cookie] of Object.entries(cookies)) {
          if (cookie && typeof cookie === 'object' && 'value' in cookie) {
            formatted[name] = (cookie as { value: string }).value;
          }
        }
        if (formatted.sessionid) {
          api.post('/oauth/instagram/connect', formatted).catch(() => {});
        }

        // Remount WebView on likes page (phase 2)
        setPhase('likes');
        setMessage('Récupération de vos reels likés...');
      }
    } catch (e) {
      console.error('[InstagramSync] Cookie check error:', e);
    }
  }, [syncTriggered]);

  // Poll every 2s in login phase
  useEffect(() => {
    if (phase !== 'login' || syncTriggered) return;
    // Check immediately on mount
    checkLogin();
    const interval = setInterval(checkLogin, 2000);
    return () => clearInterval(interval);
  }, [phase, syncTriggered, checkLogin]);

  // Timeout for likes phase
  useEffect(() => {
    if (phase !== 'likes') return;
    const timeout = setTimeout(() => {
      setMessage("Timeout — la page des likes n'a pas renvoyé de données.");
      setPhase('error');
    }, 30000);
    return () => clearTimeout(timeout);
  }, [phase]);

  // Handle messages from WebView
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === 'DEBUG') {
        console.log('[InstagramSync]', msg.msg);
        return;
      }

      if (msg.type === 'SCRAPED') {
        const items: any[] = msg.items || [];
        console.log(`[InstagramSync] Scraped ${items.length} items (${msg.phase}):`, items.slice(0, 3));

        if (items.length > 0 && msg.phase === 'final') {
          importItems(items);
        } else if (items.length === 0 && msg.phase === 'empty') {
          setMessage('Aucun reel liké trouvé sur cette page.');
          setPhase('done');
        }
        return;
      }
    } catch (e) {
      console.error('[InstagramSync] onMessage error:', e);
    }
  }, []);

  // Send scraped items to backend
  const importItems = useCallback(async (items: { code: string; pk: string; thumbnailUrl: string }[]) => {
    try {
      setMessage(`Import de ${items.length} reels...`);
      const res = await api.post('/content/import-instagram-shortcodes', {
        shortcodes: items.map(i => i.code),
        items: items, // Send full items with thumbnails
      });
      const count = res.data?.newItems || 0;
      setNewItems(count);

      // Save fresh WebView cookies for transcription
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
      setPhase('done');
    } catch (e) {
      console.error('[InstagramSync] Import error:', e);
      setMessage("Erreur lors de l'import.");
      setPhase('error');
    }
  }, [queryClient]);

  // --- No CookieManager ---
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

  const title = phase === 'login' ? 'Connexion Instagram' : 'Sync Instagram';

  return (
    <>
      <Stack.Screen options={{ title, headerBackTitle: 'Retour' }} />
      <SafeAreaView style={styles.container}>
        {/* Login phase: instructions */}
        {phase === 'login' && (
          <View style={styles.instructions}>
            <Text variant="body" color="secondary">
              Connectez-vous à Instagram. La synchronisation démarrera automatiquement.
            </Text>
          </View>
        )}

        {/* WebView — remounted via key when phase changes */}
        <View style={styles.webviewContainer}>
          {(phase === 'login' || phase === 'likes') && (
            <WebView
              key={phase} // Forces remount when switching from login → likes
              source={{ uri: phase === 'likes' ? LIKES_PAGE_URL : 'https://www.instagram.com/' }}
              userAgent={USER_AGENT}
              onLoadEnd={() => {
                if (phase === 'login') checkLogin();
              }}
              onNavigationStateChange={() => {
                if (phase === 'login') checkLogin();
              }}
              onMessage={onMessage}
              injectedJavaScript={phase === 'likes' ? SCRAPE_JS : undefined}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              thirdPartyCookiesEnabled={true}
              sharedCookiesEnabled={true}
              incognito={false}
              style={styles.webview}
            />
          )}

          {/* Overlay for likes/done/error phases */}
          {phase === 'likes' && (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text variant="body" color="secondary" style={{ marginTop: spacing.md }}>
                {message || 'Chargement de vos likes...'}
              </Text>
            </View>
          )}

          {(phase === 'done' || phase === 'error') && (
            <View style={styles.overlay}>
              <Text variant="h3" style={styles.centerText}>{message}</Text>
              <View style={styles.buttonRow}>
                <Button
                  variant="outline"
                  onPress={() => {
                    setSyncTriggered(false);
                    setPhase('login');
                    setMessage('');
                    setNewItems(0);
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
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    zIndex: 10,
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
