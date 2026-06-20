'use client';

import React from 'react';
import { HomeCommandHero } from '@/components/home/premium/command/HomeCommandHero';
import { HomeCommandGameDay } from '@/components/home/premium/command/HomeCommandGameDay';
import { HomeCommandLiveStrip } from '@/components/home/premium/command/HomeCommandLiveStrip';
import { HomeCommandRecruitingSnapshot } from '@/components/home/premium/command/HomeCommandRecruitingSnapshot';
import { HomeCommandFutureCastPreview } from '@/components/home/premium/command/HomeCommandFutureCastPreview';
import { HomeCommandBeatHighlights } from '@/components/home/premium/command/HomeCommandBeatHighlights';
import type {
  HomeBeatPostView,
  HomeFutureCastTargetView,
  HomeGameDayView,
  HomeRecruitingMetricsView,
} from '@/components/home/premium/command/home-command-utils';

type Props = {
  gameDay: HomeGameDayView;
  recruitingMetrics: HomeRecruitingMetricsView;
  futureCastTargets: HomeFutureCastTargetView[];
  beatPosts: HomeBeatPostView[];
  loading?: boolean;
};

/** Home command center — hero → gameday → strip → recruiting → FutureCast → beat writers. */
export function HomeCommandCenter({
  gameDay,
  recruitingMetrics,
  futureCastTargets,
  beatPosts,
  loading,
}: Props): React.ReactElement {
  return (
    <div className="home-page__frame">
      <HomeCommandHero />
      <HomeCommandGameDay game={gameDay} />
      <HomeCommandLiveStrip />
      <HomeCommandRecruitingSnapshot metrics={recruitingMetrics} loading={loading} />
      <HomeCommandFutureCastPreview targets={futureCastTargets} loading={loading} />
      <HomeCommandBeatHighlights posts={beatPosts} loading={loading} />
    </div>
  );
}
