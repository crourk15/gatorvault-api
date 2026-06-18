'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeMetricsSlider } from '@/components/home/HomeMetricsSlider';
import { HomeActionGrid } from '@/components/home/HomeActionGrid';
import { HomeRecruitingPulseWidget } from '@/components/home/HomeRecruitingPulseWidget';
import { HomeFutureCastPulseWidget } from '@/components/home/HomeFutureCastPulseWidget';
import { HomeHighPriorityIntelPreview } from '@/components/home/HomeHighPriorityIntelPreview';
import { HomeLiveMediaPreview } from '@/components/home/HomeLiveMediaPreview';

const HomeMovementIntelPreview = dynamic(
  () =>
    import('@/components/home/HomeMovementIntelPreview').then((m) => m.HomeMovementIntelPreview),
  {
    ssr: false,
    loading: () => <div className="gv-home-skeleton-block" aria-hidden />,
  }
);

const HomeBoardsSlider = dynamic(
  () => import('@/components/home/HomeBoardsSlider').then((m) => m.HomeBoardsSlider),
  {
    ssr: false,
    loading: () => <div className="gv-home-skeleton-block" aria-hidden />,
  }
);

const HomeLiveAlertsFeed = dynamic(
  () => import('@/components/home/HomeLiveAlertsFeed').then((m) => m.HomeLiveAlertsFeed),
  {
    ssr: false,
    loading: () => <div className="gv-home-skeleton-block" aria-hidden />,
  }
);

/**
 * Desktop – Home Command Center (Figma 1440×900)
 * 12-col grid · 3-col sticky metrics (260px) · 9-col fluid main content
 */
export function HomePageDesktop(): React.ReactElement {
  return (
    <div className="gv-home-desktop mobile-app" data-testid="vault-home-desktop">
      <div className="gv-hcc-desktop-artboard">
        <div className="gv-hcc-desktop-frame">
          <aside className="gv-hcc-desktop-left" aria-label="Left – Metrics">
            <HomeHeader />
            <HomeMetricsSlider />
          </aside>

          <main className="gv-hcc-desktop-right" aria-label="Right – Command Center">
            <HomeActionGrid />
            <HomeRecruitingPulseWidget />
            <HomeFutureCastPulseWidget />
            <HomeHighPriorityIntelPreview />
            <HomeMovementIntelPreview />
            <HomeBoardsSlider />
            <HomeLiveAlertsFeed />
            <HomeLiveMediaPreview />
          </main>
        </div>
      </div>
    </div>
  );
}
