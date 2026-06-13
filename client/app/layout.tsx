'use client';

import React from 'react';
import { GatorVaultShell } from '@/components/site/GatorVaultShell';
import '@/lib/site.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Oswald:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="fc-body gv-body">
        <GatorVaultShell>{children}</GatorVaultShell>
      </body>
    </html>
  );
}
