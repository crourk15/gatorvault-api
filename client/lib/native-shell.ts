import { isNativeApp } from '@/lib/api-base';

let initialized = false;

/** Capacitor-only boot: status bar, splash hide, safe-area class, back-button hook. */
export async function initNativeShell(): Promise<void> {
  if (!isNativeApp() || initialized) return;
  initialized = true;

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

  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
      return;
    }
    void App.minimizeApp();
  });
}
