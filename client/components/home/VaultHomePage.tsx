'use client';

import React from 'react';
import '@/lib/vault-home.css';
import '@/components/home/gv-home-page.css';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeMetricsSlider } from '@/components/home/HomeMetricsSlider';
import { HomeActionGrid } from '@/components/home/HomeActionGrid';
import { HomeRecruitingPulseWidget } from '@/components/home/HomeRecruitingPulseWidget';
import { HomeFutureCastPulseWidget } from '@/components/home/HomeFutureCastPulseWidget';
import { HomeHighPriorityIntelPreview } from '@/components/home/HomeHighPriorityIntelPreview';
import { HomeMovementIntelPreview } from '@/components/home/HomeMovementIntelPreview';
import { HomeBoardsSlider } from '@/components/home/HomeBoardsSlider';
import { HomeLiveAlertsFeed } from '@/components/home/HomeLiveAlertsFeed';
import { HomeLiveMediaPreview } from '@/components/home/HomeLiveMediaPreview';

export function VaultHomePage(): React.ReactElement {
  return (
    <div className="mobile-app gv-home-page" data-testid="vault-home">
      <HomeHeader />

      <section className="gv-section gv-section--metrics">
        <HomeMetricsSlider />
      </section>

      <section className="gv-section gv-section--actions">
        <HomeActionGrid />
      </section>

      <section className="gv-section gv-section--pulse">
        <HomeRecruitingPulseWidget />
      </section>

      <section className="gv-section gv-section--pulse">
        <HomeFutureCastPulseWidget />
      </section>

      <section className="gv-section gv-section--intel">
        <HomeHighPriorityIntelPreview />
      </section>

      <section className="gv-section gv-section--movement">
        <HomeMovementIntelPreview />
      </section>

      <section className="gv-section gv-section--boards">
        <HomeBoardsSlider />
      </section>

      <section className="gv-section gv-section--alerts">
        <HomeLiveAlertsFeed />
      </section>

      <section className="gv-section gv-section--media">
        <HomeLiveMediaPreview />
      </section>
    </div>
  );
}
