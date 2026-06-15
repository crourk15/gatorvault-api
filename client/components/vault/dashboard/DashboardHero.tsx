'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { HotCarouselItem, TickerResponse } from '@/lib/vault-dashboard-api';
import { GV_COPY } from '@/lib/gatorvault-copy';
import { GatorVaultMonogram } from '@/components/brand/GatorVaultWordmark';
import { InsiderBadge } from '@/components/brand/InsiderBadge';
import { badgeLevelForTier, type InsiderBadgeLevel } from '@/lib/gatorvault-brand-assets';
import { loadSession, effectiveTier } from '@/lib/auth-api';

type Props = {
  ticker: TickerResponse | null;
  momentumPct: number;
  daysUntilGame: number;
  loading?: boolean;
};

const CAROUSEL_INTERVAL_MS = 5000;

export function DashboardHero({
  ticker,
  momentumPct,
  daysUntilGame,
  loading,
}: Props): React.ReactElement {
  const [slide, setSlide] = useState(0);
  const [badgeLevel, setBadgeLevel] = useState<InsiderBadgeLevel>(3);

  useEffect(() => {
    const session = loadSession();
    setBadgeLevel(badgeLevelForTier(effectiveTier(session)));
  }, []);

  const hot = useMemo(() => {
    if (!ticker) return [];
    return ticker.hotToday?.length
      ? ticker.hotToday
      : ticker.items.slice(0, 5).map((item) => ({
          id: item.id,
          title: item.text,
          category: item.category,
          url: item.url,
        }));
  }, [ticker]);

  useEffect(() => {
    if (hot.length <= 3) return undefined;
    const timer = window.setInterval(() => {
      setSlide((prev) => (prev + 1) % hot.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [hot.length]);

  const visibleCards = useMemo(() => {
    if (hot.length === 0) return [];
    const cards: HotCarouselItem[] = [];
    for (let i = 0; i < Math.min(3, hot.length); i += 1) {
      cards.push(hot[(slide + i) % hot.length]);
    }
    return cards;
  }, [hot, slide]);

  if (loading || !ticker) {
    return (
      <section className="gv-dash-hero" aria-label="GameDay hero">
        <div className="gv-dash-hero__bg" aria-hidden="true" />
        <div className="gv-dash__frame">
          <div className="gv-dash-skeleton gv-dash-skeleton--hero" />
        </div>
      </section>
    );
  }

  const storyline = ticker.storyline || GV_COPY.onboarding;
  const trending = momentumPct >= 70 ? '↑' : momentumPct >= 50 ? '→' : '↓';

  return (
    <section className="gv-dash-hero" aria-label="GameDay hero" data-testid="dashboard-hero">
      <div className="gv-dash-hero__bg" aria-hidden="true" />
      <div className="gv-dash-hero__overlay" aria-hidden="true" />

      <div className="gv-dash__frame gv-dash-hero__inner">
        <div className="gv-dash-hero__split">
          <div className="gv-dash-hero__left">
            <div className="gv-dash-hero__brand-row">
              <GatorVaultMonogram height={36} className="gv-dash-hero__monogram" />
              <InsiderBadge level={badgeLevel} size={36} className="gv-dash-hero__badge" />
              <span className="gv-dash-hero__brand">{GV_COPY.brand.insider.toUpperCase()}</span>
            </div>
            <p className="gv-dash-hero__story-label">{GV_COPY.headlines.heroStoryline.toUpperCase()}</p>
            <p className="gv-dash-hero__storyline">&ldquo;{storyline}&rdquo;</p>

            <div className="gv-dash-hero__countdown">
              <span className="gv-dash-hero__countdown-pill">
                FLORIDA vs FAU — {daysUntilGame} DAYS
              </span>
            </div>

            <div
              className="gv-dash-hero__temp"
              title={GV_COPY.tooltips.momentum}
            >
              <div className="gv-dash-hero__temp-row">
                <span aria-hidden="true">🔥</span>
                <span>
                  Recruiting Momentum: {momentumPct}% (Trending {trending})
                </span>
              </div>
              <div
                className="gv-dash-hero__temp-bar"
                role="progressbar"
                aria-valuenow={momentumPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="gv-dash-hero__temp-fill" style={{ width: `${momentumPct}%` }} />
              </div>
            </div>
          </div>

          <div className="gv-dash-hero__right">
            <p className="gv-dash-hero__carousel-label">{GV_COPY.headlines.whatsHot.toUpperCase()}</p>
            <div className="gv-dash-hero__carousel" aria-label="What's hot today carousel">
              {visibleCards.map((item) => (
                <a key={item.id} href={item.url} className="gv-dash-hero__carousel-item">
                  <span className="gv-dash-hero__carousel-dot" aria-hidden="true">
                    •
                  </span>
                  <span className="gv-dash-hero__carousel-title">{item.title}</span>
                </a>
              ))}
              {visibleCards.length === 0 && (
                <div className="gv-dash-hero__carousel-item gv-dash-hero__carousel-item--empty">
                  Live feed updating…
                </div>
              )}
            </div>
            {hot.length > 3 && (
              <div className="gv-dash-hero__carousel-dots" aria-hidden="true">
                {hot.map((item, idx) => (
                  <span
                    key={item.id}
                    className={`gv-dash-hero__carousel-pip${idx === slide ? ' is-active' : ''}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
