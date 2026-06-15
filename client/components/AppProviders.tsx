'use client';

import React from 'react';
import { ThemeProvider } from '@/components/ThemeProvider';

export function AppProviders({ children }: { children: React.ReactNode }): React.ReactElement {
  return <ThemeProvider>{children}</ThemeProvider>;
}
