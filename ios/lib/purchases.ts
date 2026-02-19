/**
 * RevenueCat SDK configuration and helpers
 *
 * Handles initialization, user identification, and entitlement checking.
 * All purchase logic flows through RevenueCat — never call StoreKit directly.
 *
 * OTA-safe: gracefully degrades when the native module isn't available
 * (i.e., the app binary was built before react-native-purchases was added).
 */

let Purchases: any = null;
let LOG_LEVEL: any = {};

try {
  const mod = require('react-native-purchases');
  Purchases = mod.default;
  LOG_LEVEL = mod.LOG_LEVEL || {};
} catch {
  // Native module not available — all functions will be no-ops
}

// RevenueCat public API key (safe to embed — identifies your app, not a secret)
const REVENUECAT_API_KEY = 'appl_xyGHXMOylgGIyTDnxsVWFJFMsIf';

// Entitlement identifier — must match what's configured in RevenueCat dashboard
export const ENTITLEMENT_ID = 'Ankora Pro';

/** Whether the native RevenueCat SDK is available in this binary */
export const isRevenueCatAvailable = Purchases !== null;

/**
 * Initialize RevenueCat SDK.
 * Call once at app startup (root layout), before any purchase operations.
 */
export function configurePurchases() {
  if (!Purchases) return;
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }
  Purchases.configure({ apiKey: REVENUECAT_API_KEY });
}

/**
 * Identify user with RevenueCat after login.
 * Links the device's purchase history to your backend user ID.
 */
export async function identifyUser(userId: string): Promise<any> {
  if (!Purchases) return null;
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    return customerInfo;
  } catch (error) {
    console.error('[RevenueCat] Failed to identify user:', error);
    return null;
  }
}

/**
 * Reset RevenueCat user on logout.
 * Creates a new anonymous user so the next login starts fresh.
 */
export async function resetUser(): Promise<void> {
  if (!Purchases) return;
  try {
    await Purchases.logOut();
  } catch (error) {
    console.error('[RevenueCat] Failed to reset user:', error);
  }
}

/**
 * Check if a CustomerInfo object has active "Ankora Pro" entitlement.
 */
export function hasProAccess(customerInfo: any): boolean {
  if (!customerInfo?.entitlements?.active) return false;
  return typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
}

/**
 * Get current customer info (cached by SDK, safe to call frequently).
 */
export async function getCustomerInfo(): Promise<any> {
  if (!Purchases) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.error('[RevenueCat] Failed to get customer info:', error);
    return null;
  }
}

/**
 * Restore purchases — required by Apple.
 * Only call from an explicit user action (e.g. "Restore Purchases" button).
 */
export async function restorePurchases(): Promise<any> {
  if (!Purchases) return null;
  try {
    return await Purchases.restorePurchases();
  } catch (error) {
    console.error('[RevenueCat] Failed to restore purchases:', error);
    return null;
  }
}
