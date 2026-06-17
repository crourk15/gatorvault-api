'use client';

import React from 'react';
import { SITE_ROUTES } from '@/lib/site-routes';

const DEPTH = [
  { unit: 'QB', starter: 'Lagway', battle: 'Set' },
  { unit: 'WR', starter: 'Robinson', battle: 'Open' },
  { unit: 'EDGE', starter: 'Pringle', battle: 'Set' },
];

const INJURIES = [
  { player: 'Henderson', status: 'OUT', tone: 'down' as const },
  { player: 'Wilson', status: 'Questionable', tone: 'hot' as const },
];

const BATTLES = [
  { pos: 'LG', leaders: 'Petit / Banks' },
  { pos: 'CB2', leaders: 'Day / McClain' },
];

export function DashboardTeamSnapshot(): React.ReactElement {
  return (
    <article className="gv-dash-panel gv-dash-card" aria-label="Team snapshot" data-testid="dashboard-team-snapshot">
      <p className="gv-dash-card__eyebrow">Team Hub</p>
      <h2 className="gv-dash-panel__title">Roster command snapshot</h2>

      <div className="gv-dash-team-snapshot__sections">
        <section className="gv-dash-team-snapshot__section">
          <h3 className="gv-dash-recruit-panel__label">Depth chart preview</h3>
          <ul className="gv-dash-recruit-panel__list">
            {DEPTH.map((row) => (
              <li key={row.unit}>
                <strong>{row.unit}</strong> — {row.starter}
                <span className={`gv-dash-signal gv-dash-signal--${row.battle === 'Open' ? 'hot' : 'portal'}`}>
                  {row.battle}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="gv-dash-team-snapshot__section">
          <h3 className="gv-dash-recruit-panel__label">Injuries</h3>
          <ul className="gv-dash-recruit-panel__list">
            {INJURIES.map((row) => (
              <li key={row.player}>
                {row.player}
                <span className={`gv-dash-signal gv-dash-signal--${row.tone === 'down' ? 'flip' : 'hot'}`}>
                  {row.status}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="gv-dash-team-snapshot__section">
          <h3 className="gv-dash-recruit-panel__label">Position battles</h3>
          <ul className="gv-dash-recruit-panel__list">
            {BATTLES.map((row) => (
              <li key={row.pos}>
                <strong>{row.pos}</strong> — {row.leaders}
              </li>
            ))}
          </ul>
        </section>

        <section className="gv-dash-team-snapshot__section">
          <h3 className="gv-dash-recruit-panel__label">Snap projections</h3>
          <p className="gv-dash-card__body">
            Starters locked at <strong>18/22</strong> — rotation tightening ahead of fall camp.
          </p>
        </section>
      </div>

      <a href={SITE_ROUTES.team} className="gv-dash-card__link">
        Open Team Hub →
      </a>
    </article>
  );
}
