'use client';

import React from 'react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { RouteErrorRecovery } from '@/components/RouteErrorRecovery';
import { NativeShellInit } from '@/components/native/NativeShellInit';

export function AppProviders({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <NativeShellInit />
        <RouteErrorRecovery />
        {children}
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
}
