import { isNativeApp } from '@/lib/api-base';

let initialized = false;

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

  try {
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

async function initIosPurchases(): Promise<void> {
  try {
    const { loadSession } = await import('@/lib/auth-api');
    const { verifyApplePurchase } = await import('@/lib/subscription-api');
    const { initIosPurchaseListeners, finishIosPurchase } = await import('@/lib/ios-iap');
    await initIosPurchaseListeners(async ({ productId, transactionId }) => {
      const session = loadSession();
      if (!session?.token) return;
      await verifyApplePurchase({ productId, transactionId });
      await finishIosPurchase(transactionId);
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
