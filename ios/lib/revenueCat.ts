import Purchases, {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';
import { Platform } from 'react-native';

// TODO: Replace with actual RevenueCat API key from dashboard
const REVENUECAT_API_KEY_IOS = 'appl_PLACEHOLDER_KEY';
const REVENUECAT_API_KEY_ANDROID = 'goog_PLACEHOLDER_KEY';

let isInitialized = false;

export async function initRevenueCat(): Promise<void> {
  if (isInitialized) return;

  const apiKey =
    Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

  await Purchases.configure({ apiKey });
  isInitialized = true;
}

export async function identifyUser(userId: string): Promise<void> {
  await Purchases.logIn(userId);
}

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch {
    return null;
  }
}

export async function purchasePackage(
  pkg: PurchasesPackage
): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch {
    return null;
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch {
    return null;
  }
}

export function isProUser(customerInfo: CustomerInfo): boolean {
  return customerInfo.entitlements.active['pro'] !== undefined;
}

export async function logoutRevenueCat(): Promise<void> {
  try {
    if (await Purchases.isAnonymous()) return;
    await Purchases.logOut();
  } catch {
    // Ignore logout errors
  }
}
