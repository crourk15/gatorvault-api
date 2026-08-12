'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  /** Live NOW stories from hub/intel — rotates so the strip doesn't freeze on one line. */
  pulseStories?: string[];
  gameDay: HomeGameDayView;
  futureCastTargets: HomeFutureCastTargetView[];
  beatPosts: HomeBeatPostView[];
  loading?: boolean;
  beatLoading?: boolean;
};

const PULSE_ROTATE_MS = 8_000;

/** Home = full-bleed brand hero first; live pulse + countdown below the fold. */
export function HomeCommandCenter({
  pulseHeadline,
  pulseStories,
  gameDay,
  futureCastTargets,
  beatPosts,
  loading,
  beatLoading,
}: Props): React.ReactElement {
  const stories = useMemo(() => {
    const fromProp = (pulseStories ?? []).map((s) => s.trim()).filter(Boolean);
    if (fromProp.length) return fromProp;
    const single = pulseHeadline.trim();
    return single ? [single] : ['Live intel loading…'];
  }, [pulseStories, pulseHeadline]);

  const [storyIndex, setStoryIndex] = useState(0);

  useEffect(() => {
    setStoryIndex(0);
  }, [stories.join('\u0001')]);

  useEffect(() => {
    if (stories.length <= 1) return undefined;
    const id = window.setInterval(() => {
      setStoryIndex((prev) => (prev + 1) % stories.length);
    }, PULSE_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [stories]);

  const pulse = stories[storyIndex % stories.length] || 'Live intel loading…';

  return (
    <div className="home-wow-page__frame">
      <HomeCommandHero pulseHeadline={pulseHeadline} />
      <div className="home-wow-page__stack">
        <p className="home-wow-below-pulse" data-testid="home-hero-pulse" aria-live="polite">
          <span className="home-wow-below-pulse__label">Now</span>
          <span key={pulse}>{pulse}</span>
        </p>
        <HomeCommandGameDay game={gameDay} />
        <HomeCommandLiveStrip />
        <HomeCommandFutureCastPreview targets={futureCastTargets} loading={loading} />
        <HomeCommandBeatHighlights posts={beatPosts} loading={beatLoading ?? loading} />
      </div>
    </div>
  );
}
