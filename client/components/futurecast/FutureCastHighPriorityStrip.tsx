'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { playerProfileRoute } from '@/lib/vault-route-map';
import {
  competingSchoolsFromHighPriority,
  fitScoreDisplay,
  shortIntel,
  ufPct,
} from './futurecast-page-utils';

type Props = {
  players: HighPriorityPlayer[];
};

export function FutureCastHighPriorityStrip({ players }: Props): React.ReactElement {
  const rows = players.slice(0, 16);

  return (
    <section className="futurecast-page__section fc-panel" data-testid="fc-high-priority-strip">
      <h2 className="futurecast-page__section-title">High Priority Targets</h2>
      <p className="futurecast-page__section-sub">Top players by UF probability, fit, and priority score.</p>

      {rows.length === 0 ? (
        <p className="fc-empty">No high-priority players loaded.</p>
      ) : (
        <div className="fc-hscroll">
          {rows.map((p) => (
            <article key={p.slug} className="fc-hp-card">
              <p className="fc-hp-card__name">{p.name}</p>
              <p className="fc-hp-card__meta">{p.position} · Class 2027</p>
              <p className="fc-hp-card__meta">
                UF {ufPct(p.ufProbability)}% · Fit {fitScoreDisplay(p)} · Priority{' '}
                {p.priorityScore != null ? Math.round(p.priorityScore) : '—'}
              </p>
              <p className="fc-hp-card__intel">{shortIntel(p.notePreview || p.skinny || p.insiderNotes)}</p>
              <p className="fc-hp-card__meta">{competingSchoolsFromHighPriority(p)}</p>
              <a href={playerProfileRoute(p.slug, 'futurecast')} className="fc-card-link">
                FutureCast →
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
