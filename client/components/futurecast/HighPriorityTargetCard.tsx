'use client';

import React from 'react';
import { TrendingIndicator } from '@/components/futurecast/TrendingIndicator';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import {
  FC_METRIC_LABELS,
  formatFitPercent,
  formatPriorityScore,
  formatStaffPercent,
  formatUfPercent,
} from '@/lib/futurecast-elite-metrics';
import { formatCompositeRating, formatRank } from '@/lib/recruiting-board-utils';
import { playerProfilePath } from '@/lib/player-routes';

function fitMeterTone(score: number): 'high' | 'mid' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 50) return 'mid';
  return 'low';
}

function visitBadgeClass(type: string): string {
  if (type === 'OV') return 'gv-hp-card__visit--ov';
  if (type === 'UV') return 'gv-hp-card__visit--uv';
  return 'gv-hp-card__visit--other';
}

export function HighPriorityTargetCard({
  player,
  rank,
  compact = false,
}: {
  player: HighPriorityPlayer;
  rank?: number;
  compact?: boolean;
}): React.ReactElement {
  const href = playerProfilePath(player.slug, 'HIGH_SCHOOL', true, player.name, 'recruiting');
  const composite =
    player.compositeScore > 0
      ? formatCompositeRating(player.compositeScore)
      : player.rating
        ? formatCompositeRating(player.rating)
        : '—';
  const fitTone = fitMeterTone(player.fitScore);
  const note = player.notePreview ?? player.skinny;

  return (
    <article
      className={`gv-hp-card${compact ? ' gv-hp-card--compact' : ''}${player.headliner ? ' gv-hp-card--headliner' : ''}`}
      data-testid="high-priority-card"
    >
      <a href={href} className="gv-hp-card__link">
        <header className="gv-hp-card__head">
          <div>
            {rank != null && <span className="gv-hp-card__rank">#{rank}</span>}
            <h3 className="gv-hp-card__name">{player.name}</h3>
            <p className="gv-hp-card__meta">
              {player.position}
              {player.school ? ` · ${player.school}` : ''}
              {player.htWt ? ` · ${player.htWt}` : ''}
            </p>
          </div>
          <TrendingIndicator delta={player.movementDelta} />
        </header>

        <div className="gv-hp-card__ratings">
          <span className="gv-hp-card__composite">{composite}</span>
          <span className="gv-hp-card__composite-label">Composite</span>
          <span className="gv-hp-card__ranks">
            NATL {formatRank(player.nationalRank ?? player.natlRank)} · POS{' '}
            {formatRank(player.positionRank ?? player.posRank)} · ST{' '}
            {formatRank(player.stateRank)}
          </span>
        </div>

        {player.visitHistory.length > 0 && (
          <div className="gv-hp-card__visits">
            {player.visitHistory.map((v) => (
              <span key={v.type} className={`gv-hp-card__visit ${visitBadgeClass(v.type)}`}>
                {v.label}
              </span>
            ))}
          </div>
        )}

        <div className="gv-hp-card__metrics">
          <div className="gv-hp-card__metric">
            <span className="gv-hp-card__metric-label">{FC_METRIC_LABELS.uf}</span>
            <strong>{formatUfPercent(player.ufProbability)}</strong>
          </div>
          <div className="gv-hp-card__metric">
            <span className="gv-hp-card__metric-label">{FC_METRIC_LABELS.staff}</span>
            <strong>{formatStaffPercent(player.staffConfidence)}</strong>
          </div>
          {!compact && (
            <div className="gv-hp-card__metric">
              <span className="gv-hp-card__metric-label">{FC_METRIC_LABELS.priority}</span>
              <strong>{formatPriorityScore(player.priorityScore)}</strong>
            </div>
          )}
        </div>

        <div className="gv-hp-card__fit">
          <div className="gv-hp-card__fit-head">
            <span>{FC_METRIC_LABELS.fit}</span>
            <span>{formatFitPercent(player.fitScore)}</span>
          </div>
          <div className="gv-hp-card__fit-track" aria-hidden>
            <div
              className={`gv-hp-card__fit-fill gv-hp-card__fit-fill--${fitTone}`}
              style={{ width: `${Math.min(100, Math.max(0, player.fitScore))}%` }}
            />
          </div>
        </div>

        {!compact && note && (
          <div className="rh-analyst-signals gv-hp-card__signals">
            <span className="rh-analyst-signals__label">Analyst Signals</span>
            <p className="rh-analyst-signals__text">{note}</p>
          </div>
        )}

        {!compact && player.predictors.length > 0 && (
          <ul className="gv-hp-card__predictors">
            {player.predictors.map((p) => (
              <li key={p.name}>
                {p.name}
                {p.score > 0 ? ` · ${p.score}%` : ''}
              </li>
            ))}
          </ul>
        )}
      </a>
    </article>
  );
}
