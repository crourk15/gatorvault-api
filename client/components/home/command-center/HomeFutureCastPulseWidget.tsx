'use client';

import React from 'react';
import type { FutureCastWidgetBundle } from '@/lib/futurecast-home-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { SITE_ROUTES } from '@/lib/site-routes';
import { computeFcPulseMetrics } from './home-command-data';

type Props = {
  fcBundle: FutureCastWidgetBundle | null;
  movement: StaffDashboardResponse | null;
  classYear?: number;
  loading?: boolean;
};

function MeterBar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: 'heat' | 'vol';
}): React.ReactElement {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="gv-hcc-meter">
      <div className="gv-hcc-meter__head">
        <span className="gv-hcc-meter__label">{label}</span>
        <span className="gv-hcc-meter__value">{value}{tone === 'vol' ? '⚡' : ''}</span>
      </div>
      <div className={`gv-hcc-meter__track gv-hcc-meter__track--${tone}`}>
        <div className="gv-hcc-meter__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function HomeFutureCastPulseWidget({
  fcBundle,
  movement,
  classYear = 2027,
  loading,
}: Props): React.ReactElement {
  if (loading) {
    return (
      <section className="gv-hcc-section gv-hcc-widget gv-hcc-skeleton" style={{ minHeight: 200 }} aria-hidden />
    );
  }

  const { commitLikelihood, activeBattles, volatility } = computeFcPulseMetrics(fcBundle, movement);

  return (
    <section className="gv-hcc-section gv-hcc-widget gv-hcc-widget--fc" data-testid="home-fc-pulse">
      <header className="gv-hcc-widget__head">
        <h2 className="gv-hcc-widget__title">UF FutureCast Pulse — {classYear} Class</h2>
      </header>
      <p className="gv-hcc-widget__meta">Commit Likelihood: {commitLikelihood}% (7d)</p>
      <div className="gv-hcc-prob-bar" aria-label={`Commit likelihood ${commitLikelihood}%`}>
        <div className="gv-hcc-prob-bar__track">
          <div className="gv-hcc-prob-bar__fill gv-hcc-prob-bar__fill--fc" style={{ width: `${commitLikelihood}%` }} />
        </div>
      </div>
      <p className="gv-hcc-widget__meta">Active Battles: {activeBattles}</p>
      <MeterBar label="Battle Heat" value={Math.min(10, activeBattles + 2)} max={10} tone="heat" />
      <p className="gv-hcc-widget__meta">Volatility: {volatility}⚡</p>
      <MeterBar label="Volatility Index" value={volatility} max={100} tone="vol" />
      <a href={SITE_ROUTES.futurecast} className="gv-hcc-widget__cta">
        Open FutureCast Lab →
      </a>
    </section>
  );
}
