'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { playerProfileRoute } from '@/lib/site-routes';

type Props = {
  player: HighPriorityPlayer;
};

function ufPct(p: HighPriorityPlayer): number {
  const raw = p.ufProbability;
  if (raw == null) return 0;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}

function movementDelta(player: HighPriorityPlayer): number {
  return player.delta7d ?? player.movementDelta ?? 0;
}

function lastIntel(p: HighPriorityPlayer): string {
  const text = p.notePreview?.trim() || p.insiderNotes?.trim() || p.skinny?.trim() || 'Tracking active';
  return text.length > 90 ? `${text.slice(0, 87)}…` : text;
}

function competingSchools(p: HighPriorityPlayer): string {
  if (p.predictors?.length) return p.predictors.slice(0, 3).map((x) => x.name).join(' · ');
  if (p.committedTo) return p.committedTo;
  return '—';
}

function MovementSparkline({ end, delta }: { end: number; delta: number }): React.ReactElement {
  const start = Math.max(0, Math.min(100, end - delta));
  const pts = [start, start + delta * 0.25, start + delta * 0.5, start + delta * 0.75, end];
  const coords = pts.map((v, i) => `${(i / 4) * 40},${22 - (v / 100) * 18}`).join(' ');
  const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return (
    <svg className={`rh-movement-sparkline rh-movement-sparkline--${trend}`} viewBox="0 0 40 24" aria-hidden>
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MovementBadge({ delta }: { delta: number }): React.ReactElement {
  if (delta > 0) {
    return (
      <span className="rh-movement-badge rh-movement-badge--rise">
        <span className="rh-movement-badge__icon" aria-hidden>
          ↑
        </span>
        +{Math.abs(delta)}%
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="rh-movement-badge rh-movement-badge--fall">
        <span className="rh-movement-badge__icon" aria-hidden>
          ↓
        </span>
        {delta}%
      </span>
    );
  }
  return (
    <span className="rh-movement-badge rh-movement-badge--flat">
      <span className="rh-movement-badge__icon" aria-hidden>
        →
      </span>
      —
    </span>
  );
}

export function FutureCastRow({ player }: Props): React.ReactElement {
  const delta = movementDelta(player);
  const intel = lastIntel(player);
  const hasAnalystNote = intel !== 'Tracking active';

  return (
    <tr>
      <td>
        <a href={playerProfileRoute(player.slug, 'futurecast')} className="rh-fc-row__player">
          <strong>{player.name}</strong>
          <span>
            {player.position}
            {player.school ? ` · ${player.school}` : ''}
          </span>
        </a>
      </td>
      <td className="rh-fc-row__pct">{ufPct(player)}%</td>
      <td className="rh-fc-row__move">
        <div className="rh-movement-stock-row__right">
          <MovementSparkline end={ufPct(player)} delta={delta} />
          <MovementBadge delta={delta} />
        </div>
      </td>
      <td className="rh-fc-row__intel">
        {hasAnalystNote ? (
          <div className="rh-analyst-signals">
            <span className="rh-analyst-signals__label">Analyst Signals</span>
            <p className="rh-analyst-signals__text">{intel}</p>
          </div>
        ) : (
          <span className="rh-analyst-signals__text">{intel}</span>
        )}
      </td>
      <td>{competingSchools(player)}</td>
      <td>{player.fitScore != null ? Math.round(player.fitScore) : '—'}</td>
    </tr>
  );
}
