import { isNativeApp } from '@/lib/api-base';

let initialized = false;

const PENDING_IAP_KEY = 'gv_pending_iap';

type PendingIap = { productId: string; transactionId: string };

/** Capacitor-only boot: status bar, splash hide, safe-area class, native routing fixes. */
export async function initNativeShell(): Promise<void> {
  if (!isNativeApp() || initialized) return;
  initialized = true;

  const { runNativeAppEntry } = await import('@/lib/native-app-entry');
  runNativeAppEntry();

  document.documentElement.classList.add('gv-native-app');

  const [{ App }, { SplashScreen }, { StatusBar, Style }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/splash-screen'),
    import('@capacitor/status-bar'),
  ]);

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0a1628' });
  } catch {
    /* simulator / unsupported */
  }

  // Hide splash after first paint so cold start does not flash an empty WebView.
  try {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
    await SplashScreen.hide();
  } catch {
    /* ok */
  }

  void initIosPurchases();
  void initNativePush();

  void App.addListener('appUrlOpen', ({ url }) => {
    void handleAppUrlOpen(url);
  });

  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
      return;
    }
    void App.minimizeApp();
  });
}

async function handleAppUrlOpen(url: string): Promise<void> {
  try {
    const { vaultPathFromOpenUrl } = await import('@/lib/native-deep-link');
    const { navigateVaultHref } = await import('@/lib/navigate-vault-href');
    const path = vaultPathFromOpenUrl(url);
    if (!path) return;
    navigateVaultHref(path);
  } catch {
    /* ignore malformed open URL */
  }
}

async function readPendingIap(): Promise<PendingIap | null> {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PENDING_IAP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PendingIap;
      if (parsed?.productId && parsed?.transactionId) return parsed;
    }
  } catch {
    /* ignore */
  }
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: PENDING_IAP_KEY });
    if (!value) return null;
    const parsed = JSON.parse(value) as PendingIap;
    if (parsed?.productId && parsed?.transactionId) return parsed;
  } catch {
    /* plugin missing */
  }
  return null;
}

async function stashPendingIap(payload: PendingIap): Promise<void> {
  const raw = JSON.stringify(payload);
  try {
    window.localStorage.setItem(PENDING_IAP_KEY, raw);
  } catch {
    /* ignore */
  }
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key: PENDING_IAP_KEY, value: raw });
  } catch {
    /* plugin missing */
  }
}

async function clearPendingIap(): Promise<void> {
  try {
    window.localStorage.removeItem(PENDING_IAP_KEY);
  } catch {
    /* ignore */
  }
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.remove({ key: PENDING_IAP_KEY });
  } catch {
    /* plugin missing */
  }
}

async function initIosPurchases(): Promise<void> {
  try {
    const { loadSession, ensureSessionHydrated } = await import('@/lib/auth-api');
    const { verifyApplePurchase } = await import('@/lib/subscription-api');
    const {
      initIosPurchaseListeners,
      finishIosPurchase,
      appAccountTokenForEmail,
    } = await import('@/lib/ios-iap');

    const handleTx = async ({
      productId,
      transactionId,
    }: {
      productId: string;
      transactionId: string;
    }) => {
      await ensureSessionHydrated();
      const session = loadSession();
      if (!session?.token) {
        // Keep StoreKit unfinished until sign-in — then verify + acknowledge.
        await stashPendingIap({ productId, transactionId });
        return;
      }
      await verifyApplePurchase({
        productId,
        transactionId,
        appAccountToken: session.email
          ? appAccountTokenForEmail(session.email)
          : undefined,
      });
      await finishIosPurchase(transactionId);
      await clearPendingIap();
    };

    await initIosPurchaseListeners(handleTx);

    const flushPending = async () => {
      const pending = await readPendingIap();
      if (!pending) return;
      await handleTx(pending);
    };

    await flushPending();
    window.addEventListener('gv-auth-changed', () => {
      void flushPending();
    });
  } catch {
    /* plugin unavailable outside iOS build */
  }
}

async function initNativePush(): Promise<void> {
  try {
    const { initNativePushTapHandler } = await import('@/lib/native-push');
    await initNativePushTapHandler();
  } catch {
    /* plugin unavailable outside iOS build */
  }
}
