'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import '@/lib/vault-home.css';
import '@/components/home/home-command-center.css';
import '@/components/home/command-center/home-command-center-desktop.css';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { HomePageDesktop } from '@/components/home/command-center/HomePageDesktop';

const HomePageMobile = dynamic(
  () => import('@/components/home/command-center/HomePageMobile').then((m) => m.HomePageMobile),
  {
    ssr: false,
    loading: () => (
      <div className="mobile-app gv-home-page" data-testid="vault-home-loading">
        <div className="gv-home-skeleton-block" style={{ minHeight: 240 }} aria-hidden />
      </div>
    ),
  }
);

const PREFETCH_ROUTES = ['/vault/recruiting', '/vault/futurecast', '/vault/team'] as const;

export function VaultHomePage(): React.ReactElement {
  const isDesktop = useIsDesktop();
  const router = useRouter();

  useEffect(() => {
    PREFETCH_ROUTES.forEach((route) => {
      router.prefetch(route);
    });
  }, [router]);

  return isDesktop ? <HomePageDesktop /> : <HomePageMobile />;
}
