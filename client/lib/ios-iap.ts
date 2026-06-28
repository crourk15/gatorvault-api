import { isNativeApp } from '@/lib/api-base';

/** Deterministic UUID-shaped token for StoreKit appAccountToken (no PII in cleartext). */
export function appAccountTokenForEmail(email: string): string {
  const seed = `gatorvault:${String(email || '').trim().toLowerCase()}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i += 1) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca6b);
  }
  const p = (n: number, len: number) => (n >>> 0).toString(16).padStart(len, '0').slice(0, len);
  return `${p(h1, 8)}-${p(h1 >>> 8, 4)}-4${p(h2, 3)}-a${p(h2 >>> 4, 3)}-${p(h1 ^ h2, 12)}`;
}

export async function isIosBillingAvailable(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const { NativePurchases } = await import('@capgo/native-purchases');
    const { isBillingSupported } = await NativePurchases.isBillingSupported();
    return Boolean(isBillingSupported);
  } catch {
    return false;
  }
}

export async function purchaseIosSubscription(
  productIdentifier: string,
  appAccountToken?: string
): Promise<{ productId: string; transactionId: string }> {
  const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
  const tx = await NativePurchases.purchaseProduct({
    productIdentifier,
    productType: PURCHASE_TYPE.SUBS,
    appAccountToken,
    autoAcknowledgePurchases: false,
  });
  if (!tx.transactionId) {
    throw new Error('Apple did not return a transaction ID.');
  }
  return {
    productId: tx.productIdentifier || productIdentifier,
    transactionId: tx.transactionId,
  };
}

export async function finishIosPurchase(transactionId: string): Promise<void> {
  const { NativePurchases } = await import('@capgo/native-purchases');
  await NativePurchases.acknowledgePurchase({ purchaseToken: transactionId });
}

export async function restoreIosPurchases(): Promise<void> {
  const { NativePurchases } = await import('@capgo/native-purchases');
  await NativePurchases.restorePurchases();
}

export async function openIosSubscriptionManagement(): Promise<void> {
  const { NativePurchases } = await import('@capgo/native-purchases');
  await NativePurchases.manageSubscriptions();
}

export async function initIosPurchaseListeners(
  onTransaction: (payload: { productId: string; transactionId: string }) => Promise<void>
): Promise<(() => void) | null> {
  if (!isNativeApp()) return null;
  try {
    const { NativePurchases } = await import('@capgo/native-purchases');
    const handle = await NativePurchases.addListener('transactionUpdated', async (tx) => {
      if (!tx.transactionId || !tx.productIdentifier) return;
      await onTransaction({
        productId: tx.productIdentifier,
        transactionId: tx.transactionId,
      });
    });
    return () => {
      void handle.remove();
    };
  } catch {
    return null;
  }
}
