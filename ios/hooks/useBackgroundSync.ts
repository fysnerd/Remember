/**
 * Trigger a background sync when the app launches or returns to foreground.
 * Calls POST /api/content/refresh (fire-and-forget, 202).
 * Backend enforces a 5-min cooldown per platform so this is safe to call often.
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import api from '../lib/api';

export function useBackgroundSync(isAuthenticated: boolean) {
  const hasSyncedOnMount = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Sync once on mount (app launch)
    if (!hasSyncedOnMount.current) {
      hasSyncedOnMount.current = true;
      triggerSync();
    }

    // Sync when app returns to foreground
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        triggerSync();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);
}

async function triggerSync() {
  try {
    await api.post('/content/refresh');
  } catch {
    // Silent — backend handles logging, we don't block the UI
  }
}
