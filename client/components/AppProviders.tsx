'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ThemeProvider } from '@/components/ThemeProvider';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { RouteErrorRecovery } from '@/components/RouteErrorRecovery';
import { FirstTouchCapture } from '@/components/FirstTouchCapture';

const NativeShellInit = dynamic(
  () => import('@/components/native/NativeShellInit').then((m) => m.NativeShellInit),
  { ssr: false }
);

export function AppProviders({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <FirstTouchCapture />
        <NativeShellInit />
        <RouteErrorRecovery />
        {children}
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
}
