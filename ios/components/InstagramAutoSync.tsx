/**
 * InstagramAutoSync — Silent background sync on app launch
 *
 * Mounts a hidden WebView that syncs Instagram liked reels automatically.
 * Only runs if:
 * - Instagram is connected (has stored cookies)
 * - Last sync was >12h ago
 * - User is authenticated
 *
 * The WebView is invisible — no UI shown to the user.
 * Reuses the same DOM scraping logic as instagram-sync.tsx.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

let CookieManager: any = null;
try {
  CookieManager = require('@preeternal/react-native-cookie-manager').default;
} catch {}

const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const LIKES_PAGE_URL = 'https://www.instagram.com/your_activity/interactions/likes/';

const AUTO_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Same scraping JS as instagram-sync.tsx
const SCRAPE_JS = `
(function() {
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
              var thumbUrl = src.replace(/s240x240/, 's640x640').replace(/&amp;/g, '&');
              items.push({ code: shortcode, pk: pk, thumbnailUrl: thumbUrl });
            }
          }
        } catch(e) {}
      }
    }
    return items;
  }

  var attempts = 0;
  function tryScape() {
    attempts++;
    var items = scrapeItems();
    if (items.length > 0) {
      window.scrollTo(0, document.body.scrollHeight);
      setTimeout(function() {
        var moreItems = scrapeItems();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'AUTO_SYNC_RESULT',
          items: moreItems
        }));
      }, 3000);
    } else if (attempts < 12) {
      setTimeout(tryScape, 1000);
    } else {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'AUTO_SYNC_RESULT',
        items: []
      }));
    }
  }
  setTimeout(tryScape, 2000);
})();
true;
`;

interface Props {
  isAuthenticated: boolean;
}

export function InstagramAutoSync({ isAuthenticated }: Props) {
  const queryClient = useQueryClient();
  const [shouldSync, setShouldSync] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'checking' | 'syncing' | 'done'>('idle');
  const hasCheckedRef = useRef(false);

  // Check on mount + on foreground if auto-sync is needed
  const checkIfSyncNeeded = useCallback(async () => {
    if (!isAuthenticated || !CookieManager || phase !== 'idle') return;
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    try {
      const { data: status } = await api.get('/oauth/status');
      const ig = status?.instagram;
      if (!ig) return; // Instagram not connected

      const lastSync = ig.lastSyncAt ? new Date(ig.lastSyncAt).getTime() : 0;
      const elapsed = Date.now() - lastSync;

      if (elapsed > AUTO_SYNC_INTERVAL_MS) {
        console.log('[InstagramAutoSync] Last sync was', Math.round(elapsed / 3600000), 'h ago — triggering auto-sync');
        // Check if WebView has valid cookies
        const cookies = await CookieManager.get('https://www.instagram.com');
        if (cookies?.sessionid?.value) {
          setPhase('syncing');
          setShouldSync(true);
        }
      }
    } catch {}
  }, [isAuthenticated, phase]);

  // Check on mount
  useEffect(() => {
    if (isAuthenticated) {
      // Small delay to not block app startup
      const timeout = setTimeout(checkIfSyncNeeded, 3000);
      return () => clearTimeout(timeout);
    }
  }, [isAuthenticated, checkIfSyncNeeded]);

  // Also check when app comes to foreground
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active' && isAuthenticated && phase === 'idle') {
        hasCheckedRef.current = false;
        checkIfSyncNeeded();
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [isAuthenticated, phase, checkIfSyncNeeded]);

  // Handle WebView messages
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'AUTO_SYNC_RESULT') {
        const items: any[] = msg.items || [];
        console.log(`[InstagramAutoSync] Scraped ${items.length} items`);
        if (items.length > 0) {
          api.post('/content/import-instagram-shortcodes', {
            shortcodes: items.map((i: any) => i.code),
            items,
          }).then((res) => {
            const count = res.data?.newItems || 0;
            console.log(`[InstagramAutoSync] Imported ${count} new reels`);
            if (count > 0) {
              queryClient.invalidateQueries({ queryKey: ['content'] });
              queryClient.invalidateQueries({ queryKey: ['inbox'] });
              queryClient.invalidateQueries({ queryKey: ['home'] });
            }
          }).catch(() => {});

          // Also save fresh cookies
          if (CookieManager) {
            CookieManager.get('https://www.instagram.com').then((cookies: any) => {
              const formatted: Record<string, string> = {};
              for (const [name, cookie] of Object.entries(cookies)) {
                if (cookie && typeof cookie === 'object' && 'value' in cookie) {
                  formatted[name] = (cookie as { value: string }).value;
                }
              }
              if (formatted.sessionid) {
                api.post('/oauth/instagram/connect', formatted).catch(() => {});
              }
            }).catch(() => {});
          }
        }
        setShouldSync(false);
        setPhase('done');
      }
    } catch {}
  }, [queryClient]);

  // Don't render anything if sync not needed
  if (!shouldSync) return null;

  // Hidden WebView that does the sync
  return (
    <WebView
      source={{ uri: LIKES_PAGE_URL }}
      userAgent={USER_AGENT}
      onMessage={onMessage}
      injectedJavaScript={SCRAPE_JS}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      thirdPartyCookiesEnabled={true}
      sharedCookiesEnabled={true}
      incognito={false}
      style={{ height: 0, width: 0, opacity: 0, position: 'absolute' }}
    />
  );
}
