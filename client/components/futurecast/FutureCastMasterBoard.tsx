'use client';

import React from 'react';
import type { FeedPrediction } from '@/lib/predictions-api';
import type { FutureCastPredictionsResponse } from '@/lib/futurecast-home-api';
import { playerProfileRoute } from '@/lib/vault-route-map';
import {
  competingSchoolsFromPrediction,
  fitScoreDisplay,
  movementArrow,
  movementClass,
  ufPct,
} from './futurecast-page-utils';

type Props = {
  commits: FeedPrediction[];
  targets: FeedPrediction[];
  predictions: FutureCastPredictionsResponse;
};

export function FutureCastMasterBoard({ commits, targets, predictions }: Props): React.ReactElement {
  const targetRows = targets.length ? targets : predictions.predictions ?? [];

  return (
    <section className="futurecast-page__section fc-panel" data-testid="fc-master-board">
      <h2 className="futurecast-page__section-title">Master Board</h2>
      <p className="futurecast-page__section-sub">
        Commits, targets, and high-priority intel for the {predictions.classYear} cycle.
      </p>

      <h3 className="futurecast-page__section-title" style={{ fontSize: '1.1rem' }}>
        Commits
      </h3>
      {commits.length === 0 ? (
        <p className="fc-empty">No commits loaded.</p>
      ) : (
        <div className="fc-commits-strip">
          {commits.slice(0, 12).map((p) => (
            <article key={p.id} className="fc-commit-card">
              <p className="fc-commit-card__name">{p.fullName}</p>
              <p className="fc-commit-card__meta">
                {p.position} · UF {ufPct(p.ufProbability ?? p.confidence)}% · Fit {fitScoreDisplay(p)}
              </p>
              <p className="fc-commit-card__meta">{competingSchoolsFromPrediction(p)}</p>
            </article>
          ))}
        </div>
      )}

      <h3 className="futurecast-page__section-title" style={{ fontSize: '1.1rem', marginTop: '1.5rem' }}>
        Targets
      </h3>
      <div className="fc-table-wrap">
        <table className="fc-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>UF %</th>
              <th>Movement</th>
              <th>Fit</th>
              <th>Competing</th>
            </tr>
          </thead>
          <tbody>
            {targetRows.slice(0, 20).map((p) => {
              const delta = p.delta ?? 0;
              return (
                <tr key={p.id}>
                  <td>
                    <a href={playerProfileRoute(p.playerSlug, 'futurecast')} className="fc-table__player">
                      <strong>{p.fullName}</strong>
                      <span>{p.position}</span>
                    </a>
                  </td>
                  <td>{ufPct(p.ufProbability ?? p.confidence)}%</td>
                  <td className={movementClass(delta)}>
                    {movementArrow(delta)} {Math.abs(delta) || '—'}
                  </td>
                  <td>{fitScoreDisplay(p)}</td>
                  <td>{competingSchoolsFromPrediction(p)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {targetRows.length === 0 ? <p className="fc-empty">No targets loaded.</p> : null}
      </div>
    </section>
  );
}
