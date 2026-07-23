'use client';

import React from 'react';
import type { NilDashboard } from '@/lib/nil-api';

type Props = {
  dashboard: NilDashboard;
};

export function NilHero({ dashboard }: Props): React.ReactElement {
  const uf = dashboard.ufStanding;
  const trendPct = uf?.trendPct ?? 0;
  const trend = trendPct > 0 ? 'up' : trendPct < 0 ? 'down' : 'flat';
  const dialValue = Math.max(0, Math.min(100, 50 + trendPct * 2));

  return (
    <section className="nil-hero nil-bleed" data-testid="nil-hero">
      <div className="nil-hero__bg" aria-hidden />
      <div className="nil-hero__inner rh-frame">
        <div className="nil-hero__copy">
          <p className="nil-hero__eyebrow">GatorVault NIL</p>
          <h1 className="nil-hero__title">NIL Tracker</h1>
          <p className="nil-hero__sub">
            Modeled NIL movement, valuations, and UF competitive position.
          </p>
        </div>
        <div className="nil-hero__dial-wrap">
          <div className="nil-hero__watermark" aria-hidden>
            UF
          </div>
          <div className="nil-trend-dial" aria-label={`UF NIL trend ${trendPct > 0 ? '+' : ''}${trendPct}%`}>
            <svg viewBox="0 0 88 88" className="nil-trend-dial__svg" aria-hidden>
              <circle cx="44" cy="44" r="36" className="nil-trend-dial__track" />
              <circle
                cx="44"
                cy="44"
                r="36"
                className={`nil-trend-dial__arc nil-trend-dial__arc--${trend}`}
                strokeDasharray={`${(dialValue / 100) * 226} 226`}
              />
            </svg>
            <div className="nil-trend-dial__center">
              <span className="nil-trend-dial__value">
                {trendPct > 0 ? '+' : ''}
                {trendPct}%
              </span>
              <span className="nil-trend-dial__label">UF trend</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
