'use client';

import React from 'react';
import type { TeamCommandStats } from '@/lib/team-hub-types';
import { TEAM_COPY, TEAM_QUICK_ACTIONS } from '@/lib/team-hub-types';

type Props = {
  stats: TeamCommandStats | null;
  loading?: boolean;
};

export function TeamTopCommandCard({ stats, loading }: Props): React.ReactElement {
  if (loading || !stats) {
    return (
      <article
        className="gv-team__cell gv-team__cell--12 gv-team-command-card"
        aria-label="Florida Football"
      >
        <div className="gv-team-skeleton" style={{ minHeight: 220 }} />
      </article>
    );
  }

  const quickStats = [
    { label: 'Roster Size', value: String(stats.rosterCount) },
    { label: 'Starters Locked', value: String(stats.startersLocked) },
    { label: 'Position Battles', value: String(stats.positionBattles) },
    {
      label: 'Offense / Defense',
      value: `${stats.offenseCount ?? '—'} / ${stats.defenseCount ?? '—'}`,
    },
  ];

  return (
    <article
      className="gv-team__cell gv-team__cell--12 gv-team-command-card gv-team-card"
      aria-label="Florida Football"
      data-testid="team-command-card"
    >
      <div className="gv-team-command-card__head">
        <div>
          <p className="gv-team-card__eyebrow">{TEAM_COPY.commandCard.eyebrow}</p>
          <h1 className="gv-team-command-card__title">{TEAM_COPY.commandCard.title}</h1>
          <p className="gv-team-command-card__subtitle">{TEAM_COPY.commandCard.subtitle}</p>
        </div>
        <span className="gv-team-command-card__status">
          {TEAM_COPY.commandCard.statusPrefix} {stats.updatedLabel}
        </span>
      </div>

      <div className="gv-team-quick-stats gv-team-command-card__stats">
        {quickStats.map((stat) => (
          <div key={stat.label} className="gv-team-quick-stats__item">
            <p className="gv-team-quick-stats__value">{stat.value}</p>
            <p className="gv-team-card__meta">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="gv-team-command-card__actions">
        {TEAM_QUICK_ACTIONS.map((action) => (
          <a key={action.href} href={action.href} className="gv-team-action-tile gv-team-command-card__action">
            <span className="gv-team-action-tile__icon" aria-hidden="true">
              {action.icon}
            </span>
            <span className="gv-team-action-tile__label">{action.label}</span>
          </a>
        ))}
      </div>
    </article>
  );
}
