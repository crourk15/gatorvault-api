import type { CapacitorConfig } from '@capacitor/cli';

/**
 * GatorVault iOS shell — bundles `out/` from Next static export.
 * Optional: CAPACITOR_SERVER_URL=https://gatorvaultinsider.com for live WebView dev.
 */
const liveServerUrl = process.env.CAPACITOR_SERVER_URL?.trim();

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
