/**
 * Hook for subscription/plan status via RevenueCat
 *
 * Uses RevenueCat's cached customer info + real-time listener.
 * Safe to call from any screen — the SDK caches internally.
 *
 * OTA-safe: returns free tier defaults when native module isn't available.
 */

import { useEffect, useState, useCallback } from 'react';
import { isRevenueCatAvailable, hasProAccess, ENTITLEMENT_ID } from '../lib/purchases';

interface SubscriptionState {
  /** Whether the user has an active "Ankora Pro" entitlement */
  isProUser: boolean;
  /** Full RevenueCat customer info (for advanced checks) */
  customerInfo: any;
  /** True while fetching initial customer info */
  isLoading: boolean;
}

export function useSubscription(): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>({
    isProUser: false,
    customerInfo: null,
    isLoading: isRevenueCatAvailable,
  });

  const updateFromCustomerInfo = useCallback((info: any) => {
    setState({
      isProUser: hasProAccess(info),
      customerInfo: info,
      isLoading: false,
    });
  }, []);

  useEffect(() => {
    if (!isRevenueCatAvailable) return;

    let Purchases: any;
    try {
      Purchases = require('react-native-purchases').default;
    } catch {
      return;
    }

    // Fetch initial customer info (cached by SDK)
    Purchases.getCustomerInfo()
      .then(updateFromCustomerInfo)
      .catch(() => setState((prev) => ({ ...prev, isLoading: false })));

    // Listen for real-time updates (purchase, restore, subscription change)
    const listener = Purchases.addCustomerInfoUpdateListener(updateFromCustomerInfo);

    return () => {
      listener.remove();
    };
  }, [updateFromCustomerInfo]);

  return state;
}
