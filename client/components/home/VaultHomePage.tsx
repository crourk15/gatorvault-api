'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import '@/lib/vault-home.css';
import '@/lib/uf-premium-home.css';
import { HomePremiumPage } from '@/components/home/premium/HomePremiumPage';

const PREFETCH_ROUTES = [
  '/vault/recruiting',
  '/vault/futurecast',
  '/vault/team',
  '/vault/community',
] as const;

export function VaultHomePage(): React.ReactElement {
  const router = useRouter();

  useEffect(() => {
    PREFETCH_ROUTES.forEach((route) => {
      router.prefetch(route);
    });
  }, [router]);

  return <HomePremiumPage />;
}
