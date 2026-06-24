import type { CapacitorConfig } from '@capacitor/cli';

/**
 * GatorVault iOS shell.
 * Release builds set CAPACITOR_SERVER_URL=https://gatorvaultinsider.com so the WebView
 * loads the live site (avoids bundled static path routing issues in Capacitor).
 */
const liveServerUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  (process.env.CAPACITOR_LIVE === '1' ? 'https://gatorvaultinsider.com' : '');

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
  ...(liveServerUrl
    ? {
        server: {
          url: liveServerUrl,
          cleartext: false,
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
