'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { playerProfileRoute } from '@/lib/site-routes';

type Props = {
  player: HighPriorityPlayer;
};

function estimateNilValuation(p: HighPriorityPlayer): string {
  const stars = p.stars ?? 4;
  const rank = p.nationalRank ?? p.natlRank ?? 200;
  const base = Math.max(35, 220 - rank / 2) * (stars >= 5 ? 1.4 : stars >= 4 ? 1 : 0.7);
  return `$${Math.round(base)}K`;
}

function ufNilFitLabel(p: HighPriorityPlayer): string {
  const fit = p.fitScore ?? p.staffConfidence ?? 55;
  if (fit >= 70) return 'High';
  if (fit >= 50) return 'Medium';
  return 'Low';
}

function marketTrend(p: HighPriorityPlayer): string {
  const d = p.movementDelta ?? 0;
  if (d > 0) return '↑ Rising';
  if (d < 0) return '↓ Cooling';
  return '→ Stable';
}

function positionBand(p: HighPriorityPlayer): string {
  const pos = (p.position || 'ATH').toUpperCase();
  const premium = ['WR', 'EDGE', 'CB', 'QB'];
  return premium.some((x) => pos.startsWith(x)) ? `${pos} — high band` : `${pos} — medium band`;
}

function comfortZone(p: HighPriorityPlayer): { label: string; level: 'in' | 'stretch' | 'out' } {
  const fit = p.fitScore ?? 55;
  if (fit >= 70) return { label: 'In UF NIL Comfort Zone', level: 'in' };
  if (fit >= 50) return { label: 'Stretch — competitive offer needed', level: 'stretch' };
  return { label: 'Above typical UF range', level: 'out' };
}

export function NILRow({ player }: Props): React.ReactElement {
  const comfort = comfortZone(player);

  return (
    <tr>
      <td>
        <a href={playerProfileRoute(player.slug, 'futurecast')} className="rh-nil-row__player">
          <strong>{player.name}</strong>
          <span>{player.position}</span>
        </a>
      </td>
      <td>{estimateNilValuation(player)}</td>
      <td>{ufNilFitLabel(player)}</td>
      <td>{marketTrend(player)}</td>
      <td>{positionBand(player)}</td>
      <td>
        <span className={`rh-nil-row__comfort rh-nil-row__comfort--${comfort.level}`}>{comfort.label}</span>
      </td>
    </tr>
  );
}
