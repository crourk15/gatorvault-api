'use client';

import React from 'react';
import type { RecruitingSnapshot, TickerResponse } from '@/lib/vault-dashboard-api';
import { QUICK_ACTIONS } from './dashboard-utils';
import { buildDashboardQuickStats } from './dashboard-quick-stats-data';

type Props = {
  ticker: TickerResponse | null;
  snapshot: RecruitingSnapshot | null;
  momentumPct: number;
  movementDelta?: number | null;
  loading?: boolean;
};

export function DashboardTopCommandCard({
  ticker,
  snapshot,
  momentumPct,
  movementDelta,
  loading,
}: Props): React.ReactElement {
  if (loading || !snapshot) {
    return (
      <article className="gv-dash-command-card" aria-label="Command center">
        <div className="gv-dash-skeleton" style={{ minHeight: 220 }} />
      </article>
    );
  }

  const subtitle =
    ticker?.storyline ||
    'Your command center for UF recruiting, intel, and movement.';
  const stats = buildDashboardQuickStats(snapshot, momentumPct, movementDelta);

  return (
    <article
      className="gv-dash-command-card gv-dash-card"
      aria-label="Command center"
      data-testid="dashboard-command-card"
    >
      <div className="gv-dash-command-card__head">
        <div>
          <p className="gv-dash-card__eyebrow">GatorVault Insider</p>
          <h1 className="gv-dash-command-card__title">GatorVault Dashboard</h1>
          <p className="gv-dash-command-card__subtitle">{subtitle}</p>
        </div>
        <span className="gv-dash-command-card__live" aria-live="polite">
          <span className="gv-dash-hero__live-dot" aria-hidden="true" />
          Live
        </span>
      </div>

      <div className="gv-dash-quick-stats gv-dash-command-card__stats">
        {stats.map((stat) => {
          const toneClass = stat.tone ? ` gv-dash-quick-stats__value--${stat.tone}` : '';
          const inner = (
            <>
              <p className={`gv-dash-quick-stats__value${toneClass}`}>{stat.value}</p>
              <p className="gv-dash-card__meta">{stat.label}</p>
            </>
          );
          return stat.href ? (
            <a key={stat.label} href={stat.href} className="gv-dash-quick-stats__item">
              {inner}
            </a>
          ) : (
            <div key={stat.label} className="gv-dash-quick-stats__item">
              {inner}
            </div>
          );
        })}
      </div>

      <div className="gv-dash-command-card__actions">
        {QUICK_ACTIONS.map((action) => (
          <a key={action.href} href={action.href} className="gv-dash-actions__tile gv-dash-command-card__action">
            <span className="gv-dash-actions__icon" aria-hidden="true">
              {action.icon}
            </span>
            <span className="gv-dash-actions__label">{action.label}</span>
          </a>
        ))}
      </div>
    </article>
  );
}
