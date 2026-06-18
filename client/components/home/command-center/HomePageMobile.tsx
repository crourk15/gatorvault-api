'use client';

import React, { useMemo } from 'react';
import { buildHomeGnlItems } from '@/lib/vault-home-api';
import { buildHomeMetricCards } from './home-command-data';
import type { HomeCommandCenterProps } from './types';
import { HomeHeader } from './HomeHeader';
import { HomeMetricsSlider } from './HomeMetricsSlider';
import { HomeActionGrid } from './HomeActionGrid';
import { HomeRecruitingPulseWidget } from './HomeRecruitingPulseWidget';
import { HomeFutureCastPulseWidget } from './HomeFutureCastPulseWidget';
import { HomeHighPriorityIntelPreview } from './HomeHighPriorityIntelPreview';
import { HomeMovementIntelPreview } from './HomeMovementIntelPreview';
import { HomeBoardsSlider } from './HomeBoardsSlider';
import { HomeLiveAlertsFeed } from './HomeLiveAlertsFeed';
import { HomeLiveMediaPreview } from './HomeLiveMediaPreview';
import './home-command-center.css';

/**
 * GatorVault Home Command Center — mobile-first live dashboard.
 */
export function HomePageMobile(props: HomeCommandCenterProps): React.ReactElement {
  const metrics = useMemo(
    () =>
      buildHomeMetricCards({
        recruiting: props.recruiting,
        movement: props.movement,
        movementIntel: props.movementIntel,
        fcBundle: props.fcBundle,
        momentumPct: props.momentumPct,
        movementDelta: props.movementDelta,
        nilPulse: props.nilPulse,
      }),
    [
      props.recruiting,
      props.movement,
      props.movementIntel,
      props.fcBundle,
      props.momentumPct,
      props.movementDelta,
      props.nilPulse,
    ]
  );

  const gnlItems = props.gnlItems.length ? props.gnlItems : buildHomeGnlItems(props.ticker);
  const updatedAt = props.ticker?.updatedAt ?? props.movementIntel?.updatedAt ?? null;

  return (
    <div className="gv-hcc mobile-app" data-testid="home-command-center">
      <HomeHeader updatedAt={updatedAt} />
      <HomeMetricsSlider cards={metrics} loading={props.loading && !props.recruiting} />
      <HomeActionGrid />
      <HomeRecruitingPulseWidget
        recruiting={props.recruiting}
        movementIntel={props.movementIntel}
        blueChipPct={props.momentumPct}
        classYear={props.classYear}
        loading={props.loading && !props.recruiting}
      />
      <HomeFutureCastPulseWidget
        fcBundle={props.fcBundle}
        movement={props.movement}
        classYear={props.classYear}
        loading={props.loading && !props.fcBundle}
      />
      <HomeHighPriorityIntelPreview
        items={props.intelItems}
        loading={props.loading && props.intelItems.length === 0}
      />
      <HomeMovementIntelPreview
        movementIntel={props.movementIntel}
        movement={props.movement}
        loading={props.loading && !props.movementIntel}
      />
      <HomeBoardsSlider boards={props.boards} loading={props.loading && props.boards.length === 0} />
      <HomeLiveAlertsFeed
        ticker={props.ticker}
        movement={props.movement}
        personalized={props.personalized}
        loading={props.loading && !props.ticker}
      />
      <HomeLiveMediaPreview items={gnlItems} />
    </div>
  );
}
