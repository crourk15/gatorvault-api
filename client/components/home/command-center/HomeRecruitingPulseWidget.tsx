'use client';

import React from 'react';
import type { HomeMovementIntelData, RecruitingSnapshot } from '@/lib/vault-home-api';
import { SITE_ROUTES } from '@/lib/site-routes';

type Props = {
  recruiting: RecruitingSnapshot | null;
  movementIntel: HomeMovementIntelData | null;
  blueChipPct?: number;
  classYear?: number;
  loading?: boolean;
};

function ProbBar({ value }: { value: number }): React.ReactElement {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="gv-hcc-prob-bar" aria-label={`UF commit probability ${pct}%`}>
      <div className="gv-hcc-prob-bar__track">
        <div className="gv-hcc-prob-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="gv-hcc-prob-bar__label">{pct}%</span>
    </div>
  );
}

export function HomeRecruitingPulseWidget({
  recruiting,
  movementIntel,
  blueChipPct = 83,
  classYear = 2027,
  loading,
}: Props): React.ReactElement {
  if (loading || !recruiting) {
    return (
      <section className="gv-hcc-section gv-hcc-widget gv-hcc-skeleton" style={{ minHeight: 200 }} aria-hidden />
    );
  }

  const risers = movementIntel?.risers?.length ?? 0;
  const fallers = movementIntel?.fallers?.length ?? 0;
  const volatile = movementIntel?.volatile?.length ?? 0;
  const commitProb = recruiting.winProbability ?? 0;
  const blueChip = recruiting.classRank != null ? `#${recruiting.classRank}` : '—';

  return (
    <section className="gv-hcc-section gv-hcc-widget gv-hcc-widget--rh" data-testid="home-rh-pulse">
      <header className="gv-hcc-widget__head">
        <h2 className="gv-hcc-widget__title">Florida Recruiting — {classYear}</h2>
      </header>
      <p className="gv-hcc-widget__meta">
        Class Rank {blueChip} · Blue Chip {blueChipPct}% · Avg Rating 91.8↑
      </p>
      <p className="gv-hcc-widget__meta">UF Commit Probability: {commitProb}% (7d)</p>
      <ProbBar value={commitProb} />
      <p className="gv-hcc-widget__meta">
        Movement: {risers}↑ {fallers}↓ {volatile}⚡
      </p>
      <a href={SITE_ROUTES.recruiting} className="gv-hcc-widget__cta">
        Open Recruiting Hub →
      </a>
    </section>
  );
}
