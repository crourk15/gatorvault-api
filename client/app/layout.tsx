import React from 'react';
import type { Viewport } from 'next';
import '@/styles/index.css';
import '@/lib/gv-theme.css';
import '@/lib/gatorvault-brand.css';
import '@/lib/gv-design-system.css';
import '@/lib/site.css';
import '@/lib/mobile-native-framework.css';
import { AppProviders } from '@/components/AppProviders';
import { NATIVE_BOOT_SCRIPT } from '@/lib/native-boot-script';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const themeBootScript = `(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark')}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: NATIVE_BOOT_SCRIPT }} />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Oswald:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="fc-body gv-body">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
