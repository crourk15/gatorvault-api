'use client';

import React from 'react';
import type { RecruitingSnapshot, TickerResponse } from '@/lib/vault-home-api';
import { QUICK_ACTIONS } from '@/components/home/home-utils';
import { buildHomeQuickStats } from '@/components/home/home-quick-stats-data';
import './HomeTopCommandCard.css';

type Props = {
  ticker: TickerResponse | null;
  snapshot: RecruitingSnapshot | null;
  momentumPct: number;
  movementDelta?: number | null;
  loading?: boolean;
};

export function HomeTopCommandCard({
  ticker,
  snapshot,
  momentumPct,
  movementDelta,
  loading,
}: Props): React.ReactElement {
  if (loading || !snapshot) {
    return (
      <article className="gv-home__cell gv-home__cell--12 gv-home-command-card" aria-label="Command center">
        <div className="gv-home-skeleton" style={{ minHeight: 220 }} />
      </article>
    );
  }

  const subtitle =
    ticker?.storyline ||
    'UF recruiting, intel, and movement — all in one place.';
  const stats = buildHomeQuickStats(snapshot, momentumPct, movementDelta);

  return (
    <article
      className="gv-home__cell gv-home__cell--12 gv-home-command-card gv-home-card"
      aria-label="Command center"
      data-testid="home-command-card"
    >
      <div className="gv-home-command-card__head">
        <div>
          <div className="gv-home-card__accent" />
          <p className="gv-home-card__eyebrow">GatorVault Insider</p>
          <h1 className="gv-home-command-card__title">GatorVault Home</h1>
          <p className="gv-home-command-card__subtitle">{subtitle}</p>
        </div>
        <span className="gv-home-command-card__status">Status: Online</span>
      </div>

      <div className="gv-home-card__stats gv-home-command-card__stats">
        {stats.map((stat) => {
          const toneClass = stat.tone ? ` gv-home-card__stat-value--${stat.tone}` : '';
          const inner = (
            <>
              <span className={`gv-home-card__stat-value${toneClass}`}>{stat.value}</span>
              <span className="gv-home-card__stat-label">{stat.label}</span>
            </>
          );
          return stat.href ? (
            <a key={stat.label} href={stat.href} className="gv-home-card__stat-item gv-home-quick-stats__item">
              {inner}
            </a>
          ) : (
            <div key={stat.label} className="gv-home-card__stat-item gv-home-quick-stats__item">
              {inner}
            </div>
          );
        })}
      </div>

      <div className="gv-home-command-card__actions">
        {QUICK_ACTIONS.map((action) => (
          <a key={action.href} href={action.href} className="gv-home-action-tile gv-home-command-card__action">
            <span className="gv-home-action-tile__icon" aria-hidden="true">
              {action.icon}
            </span>
            <span className="gv-home-action-tile__label">{action.label}</span>
          </a>
        ))}
      </div>
    </article>
  );
}
