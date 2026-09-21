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
  /** Live NOW stories from hub/intel — lead stays pinned; support rotates. */
  pulseStories?: string[];
  gameDay: HomeGameDayView;
  futureCastTargets: HomeFutureCastTargetView[];
  beatPosts: HomeBeatPostView[];
  loading?: boolean;
  beatLoading?: boolean;
};

const SUPPORT_ROTATE_MS = 7_000;
const SUPPORT_SLOTS = 2;

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

  const lead = stories[0] || 'Live intel loading…';
  const supportPool = stories.slice(1);
  const [supportOffset, setSupportOffset] = useState(0);

  useEffect(() => {
    setSupportOffset(0);
  }, [stories.join('\u0001')]);

  useEffect(() => {
    if (supportPool.length <= SUPPORT_SLOTS) return undefined;
    const id = window.setInterval(() => {
      setSupportOffset((prev) => (prev + SUPPORT_SLOTS) % supportPool.length);
    }, SUPPORT_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [supportPool]);

  const support = supportPool
    .slice(supportOffset)
    .concat(supportPool.slice(0, supportOffset))
    .slice(0, SUPPORT_SLOTS);

  return (
    <div className="home-wow-page__frame">
      <HomeCommandHero pulseHeadline={pulseHeadline} />
      <div className="home-wow-page__stack">
        <section className="home-wow-now" aria-label="Now" data-testid="home-hero-pulse">
          <span className="home-wow-now__label">Now</span>
          <ul className="home-wow-now__list">
            <li className="home-wow-now__lead" aria-live="polite">
              {lead}
            </li>
            {support.map((story) => (
              <li key={story} className="home-wow-now__item">
                {story}
              </li>
            ))}
          </ul>
        </section>
        <HomeCommandGameDay game={gameDay} />
        <HomeCommandLiveStrip />
        <HomeCommandFutureCastPreview targets={futureCastTargets} loading={loading} />
        <HomeCommandBeatHighlights posts={beatPosts} loading={beatLoading ?? loading} />
      </div>
    </div>
  );
}
