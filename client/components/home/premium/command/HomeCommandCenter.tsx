'use client';

import React from 'react';
import { HomeCommandHero } from '@/components/home/premium/command/HomeCommandHero';
import { HomeCommandGameDay } from '@/components/home/premium/command/HomeCommandGameDay';
import { HomeCommandLiveStrip } from '@/components/home/premium/command/HomeCommandLiveStrip';
import { HomeCommandRecruitingSnapshot } from '@/components/home/premium/command/HomeCommandRecruitingSnapshot';
import { HomeCommandFutureCastPreview } from '@/components/home/premium/command/HomeCommandFutureCastPreview';
import { HomeCommandVisitIntelPreview } from '@/components/home/premium/command/HomeCommandVisitIntelPreview';
import { HomeCommandBeatHighlights } from '@/components/home/premium/command/HomeCommandBeatHighlights';
import type { FlipWatchRow, MovementNarrativeRow, VisitRecapRow } from '@/lib/futurecast-high-priority-api';
import type {
  HomeBeatPostView,
  HomeFutureCastTargetView,
  HomeGameDayView,
  HomeRecruitingMetricsView,
} from '@/components/home/premium/command/home-command-utils';

type Props = {
  heroTickerItems: string[];
  gameDay: HomeGameDayView;
  recruitingMetrics: HomeRecruitingMetricsView;
  futureCastTargets: HomeFutureCastTargetView[];
  flipWatch: FlipWatchRow[];
  visitRecap: VisitRecapRow[];
  movementNarratives: MovementNarrativeRow[];
  beatPosts: HomeBeatPostView[];
  loading?: boolean;
  beatLoading?: boolean;
};

/** WOW home command center — hero → gameday → strip → recruiting → FutureCast → beat writers. */
export function HomeCommandCenter({
  heroTickerItems,
  gameDay,
  recruitingMetrics,
  futureCastTargets,
  flipWatch,
  visitRecap,
  movementNarratives,
  beatPosts,
  loading,
  beatLoading,
}: Props): React.ReactElement {
  return (
    <div className="home-wow-page__frame">
      <HomeCommandHero tickerItems={heroTickerItems} />
      <HomeCommandGameDay game={gameDay} />
      <HomeCommandLiveStrip />
      <HomeCommandRecruitingSnapshot metrics={recruitingMetrics} loading={loading} />
      <HomeCommandVisitIntelPreview
        flipWatch={flipWatch}
        visitRecap={visitRecap}
        movementNarratives={movementNarratives}
        loading={loading}
      />
      <HomeCommandFutureCastPreview targets={futureCastTargets} loading={loading} />
      <HomeCommandBeatHighlights posts={beatPosts} loading={beatLoading ?? loading} />
    </div>
  );
}
