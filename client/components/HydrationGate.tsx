'use client';

import React from 'react';
import { useHydrated } from '@/hooks/useHydrated';

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

/** Prevents hydration mismatch for client-only state (localStorage, window). */
export function HydrationGate({
  children,
  fallback = null,
}: Props): React.ReactElement | null {
  const hydrated = useHydrated();
  if (!hydrated) return fallback ? <>{fallback}</> : null;
  return <>{children}</>;
}
