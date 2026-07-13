'use client';

import React from 'react';
import { HomeCommandHero } from '@/components/home/premium/command/HomeCommandHero';
import { HomeCommandGameDay } from '@/components/home/premium/command/HomeCommandGameDay';
import { HomeCommandLiveStrip } from '@/components/home/premium/command/HomeCommandLiveStrip';
import { HomeCommandFutureCastPreview } from '@/components/home/premium/command/HomeCommandFutureCastPreview';
import { HomeCommandBeatHighlights } from '@/components/home/premium/command/HomeCommandBeatHighlights';
import type {
  HomeBeatPostView,
  HomeFutureCastTargetView,
  HomeGameDayView,
} from '@/components/home/premium/command/home-command-utils';

type Props = {
  pulseHeadline: string;
  gameDay: HomeGameDayView;
  futureCastTargets: HomeFutureCastTargetView[];
  beatPosts: HomeBeatPostView[];
  loading?: boolean;
  beatLoading?: boolean;
};

/** Home = brand + one pulse + doors + one teaser. Not a second Lab. */
export function HomeCommandCenter({
  pulseHeadline,
  gameDay,
  futureCastTargets,
  beatPosts,
  loading,
  beatLoading,
}: Props): React.ReactElement {
  return (
    <div className="home-wow-page__frame">
      <HomeCommandHero pulseHeadline={pulseHeadline} />
      <HomeCommandGameDay game={gameDay} />
      <HomeCommandLiveStrip />
      <HomeCommandFutureCastPreview targets={futureCastTargets} loading={loading} />
      <HomeCommandBeatHighlights posts={beatPosts} loading={beatLoading ?? loading} />
    </div>
  );
}
