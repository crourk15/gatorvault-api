import type { CapacitorConfig } from '@capacitor/cli';

/** Production API + bundled shell for App Store (default). Set CAPACITOR_SERVER_URL for live WebView dev only. */
const LIVE_APP_URL =
  process.env.CAPACITOR_SERVER_URL?.trim() || 'https://gatorvaultinsider.com/vault/';

const config: CapacitorConfig = {
  appId: 'com.gatorvaultinsider.app',
  appName: 'GatorVault',
  webDir: 'out',
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0a1628',
    scrollEnabled: true,
    allowsLinkPreview: false,
  },
  ...(process.env.CAPACITOR_SERVER_URL
    ? {
        server: {
          url: LIVE_APP_URL,
          cleartext: false,
          androidScheme: 'https',
        },
      }
    : {}),
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#0a1628',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a1628',
    },
  },
};

export default config;
