'use client';

import React, { useEffect, useState } from 'react';
import type { TickerResponse } from '@/lib/vault-dashboard-api';
import { GV_COPY } from '@/lib/gatorvault-copy';
import { GatorVaultMonogram } from '@/components/brand/GatorVaultWordmark';
import { InsiderBadge } from '@/components/brand/InsiderBadge';
import { badgeLevelForTier, type InsiderBadgeLevel } from '@/lib/gatorvault-brand-assets';
import { loadSession, effectiveTier } from '@/lib/auth-api';

type Props = {
  ticker: TickerResponse | null;
  loading?: boolean;
};

export function DashboardHero({ ticker, loading }: Props): React.ReactElement {
  const [badgeLevel, setBadgeLevel] = useState<InsiderBadgeLevel>(3);

  useEffect(() => {
    const session = loadSession();
    setBadgeLevel(badgeLevelForTier(effectiveTier(session)));
  }, []);

  if (loading || !ticker) {
    return (
      <section className="gv-dash-hero" aria-label="Dashboard hero">
        <div className="gv-dash-hero__bg" aria-hidden="true" />
        <div className="gv-dash__frame">
          <div className="gv-dash-skeleton gv-dash-skeleton--hero" />
        </div>
      </section>
    );
  }

  const subtitle =
    ticker.storyline ||
    'Your command center for UF recruiting, intel, and movement.';

  return (
    <section className="gv-dash-hero" aria-label="Dashboard hero" data-testid="dashboard-hero">
      <div className="gv-dash-hero__bg" aria-hidden="true" />
      <div className="gv-dash-hero__overlay" aria-hidden="true" />

      <div className="gv-dash__frame gv-dash-hero__inner">
        <div className="gv-dash-hero__brand-row">
          <GatorVaultMonogram height={32} className="gv-dash-hero__monogram" />
          <InsiderBadge level={badgeLevel} size={32} className="gv-dash-hero__badge" />
          <span className="gv-dash-hero__brand">
            <span className="gv-dash-hero__live-dot" aria-hidden="true" />
            {GV_COPY.brand.insider.toUpperCase()}
          </span>
        </div>
        <h1 className="gv-dash-hero__title">
          GatorVault Dashboard
          <span className="gv-dash-hero__title-accent" aria-hidden="true" />
        </h1>
        <p className="gv-dash-hero__subtitle">{subtitle}</p>
      </div>

      <div className="gv-dash-hero__energy-bar" aria-hidden="true" />
    </section>
  );
}
