import type { CapacitorConfig } from '@capacitor/cli';

/** Live site entry for iOS TestFlight/App Store — bundled static paths break in Capacitor. */
const LIVE_APP_URL = 'https://gatorvaultinsider.com/vault/';
const useBundledAssets = process.env.CAPACITOR_USE_BUNDLE === '1';

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
  ...(!useBundledAssets
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
