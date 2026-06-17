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

function movementArrow(delta: number): string {
  if (delta > 0) return '↑';
  if (delta < 0) return '↓';
  return '→';
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

function movementDelta(player: HighPriorityPlayer): number {
  return player.delta7d ?? player.movementDelta ?? 0;
}

export function FutureCastRow({ player }: Props): React.ReactElement {
  const delta = movementDelta(player);
  return (
    <tr>
      <td>
        <a href={playerProfileRoute(player.slug, 'futurecast')} className="rh-fc-row__player">
          <strong>{player.name}</strong>
          <span>{player.position}</span>
        </a>
      </td>
      <td className="rh-fc-row__pct">{ufPct(player)}%</td>
      <td className="rh-fc-row__move">
        {movementArrow(delta)} {Math.abs(delta) || '—'}
      </td>
      <td className="rh-fc-row__intel">{lastIntel(player)}</td>
      <td>{competingSchools(player)}</td>
      <td>{player.fitScore != null ? Math.round(player.fitScore) : '—'}</td>
    </tr>
  );
}
