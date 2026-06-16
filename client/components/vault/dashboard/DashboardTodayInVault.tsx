'use client';

import React from 'react';
import type { RecruitingSnapshot } from '@/lib/vault-dashboard-api';
import { DashboardHeatCheck } from './DashboardHeatCheck';
import { DashboardNilTrends } from './DashboardNilTrends';
import { gameWeekRoute } from '@/lib/site-routes';
import { SCHEDULE_GAMES } from '@/lib/schedule-data';
import { ProbabilityGauge } from '@/components/ui/ProbabilityGauge';

type Props = {
  snapshot: RecruitingSnapshot | null;
  loading?: boolean;
};

export function DashboardTodayInVault({ snapshot, loading }: Props): React.ReactElement {
  const nextGame = SCHEDULE_GAMES[0];
  const days = snapshot?.nextGameDays ?? 0;
  const winPct = snapshot?.winProbability ?? nextGame?.ufPct ?? 94;

  if (loading && !snapshot) {
    return (
      <section className="gv-dash-today" aria-label="Today in the Vault">
        <div className="gv-dash__frame">
          <h2 className="gv-dash-today__heading">Today in the Vault</h2>
          <div className="gv-dash-today__grid">
            {[1, 2, 3].map((n) => (
              <div key={n} className="gv-dash-card gv-dash-skeleton" style={{ minHeight: 160 }} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="gv-dash-today"
      aria-label="Today in the Vault"
      data-testid="dashboard-today"
    >
      <div className="gv-dash__frame">
        <h2 className="gv-dash-today__heading">Today in the Vault</h2>
        <div className="gv-dash-today__grid">
          <DashboardHeatCheck />
          <DashboardNilTrends snapshot={snapshot} />
          <article className="gv-dash-card gv-dash-today__card">
            <p className="gv-dash-card__eyebrow">Game Week</p>
            <h3 className="gv-dash-card__title">
              {snapshot?.nextGameLabel ?? `FLORIDA vs ${nextGame?.opp ?? 'FAU'}`}
            </h3>
            <p className="gv-dash-card__meta">{nextGame?.venue ?? 'Ben Hill Griffin Stadium'}</p>
            <div className="gv-dash-today__game-row">
              <span className="gv-dash-today__countdown">{days} days out</span>
              <ProbabilityGauge value={winPct} label="UF Win Prob" size={72} />
            </div>
            <a href={gameWeekRoute(nextGame?.id ?? '2026-01')} className="gv-dash-card__link">
              Open Game Week →
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
