'use client';

import React from 'react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { RouteErrorRecovery } from '@/components/RouteErrorRecovery';

export function AppProviders({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <RouteErrorRecovery />
        {children}
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
}
