'use client';

import React, { useMemo } from 'react';
import type { PortalWatchlistHomePlayer } from '@/lib/futurecast-home-api';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { FitScoreBadge, ModuleShell, UfProbBar, ufPctFromRaw } from './primitives';

type Props = {
  portalPlayers: PortalWatchlistHomePlayer[];
  highPriority: HighPriorityPlayer[];
};

type CrossRow = {
  id: string;
  slug: string;
  name: string;
  position: string;
  classYear: number;
  portalLikelihood: number;
  volatility: number;
  ufProb: number | null;
  fitScore: number | null;
};

export function FutureCastPortalCrossView({ portalPlayers, highPriority }: Props): React.ReactElement {
  const hpBySlug = useMemo(
    () => new Map(highPriority.map((p) => [p.slug, p])),
    [highPriority]
  );

  const rows = useMemo((): CrossRow[] => {
    return portalPlayers.slice(0, 10).map((p) => {
      const hp = hpBySlug.get(p.slug);
      return {
        id: p.id,
        slug: p.slug,
        name: p.fullName,
        position: p.position,
        classYear: p.classYear,
        portalLikelihood: Math.round(p.portalLikelihood),
        volatility: Math.round(p.volatility),
        ufProb: hp ? ufPctFromRaw(hp.ufProbability) : null,
        fitScore: hp?.fitScore ?? null,
      };
    });
  }, [portalPlayers, hpBySlug]);

  return (
    <ModuleShell
      title="Portal × FutureCast"
      sub="Transfer watchlist cross-referenced with UF commit likelihood and fit."
      action={
        <a href="/vault/futurecast" className="rh-cc-link">
          Portal watchlist →
        </a>
      }
      testId="fc-lab-portal-cross"
    >
      {rows.length === 0 ? (
        <p className="rh-cc-empty">No portal watchlist entries loaded.</p>
      ) : (
        <div className="fc-lab-portal-list">
          {rows.map((row) => (
            <article key={row.id} className="fc-lab-portal-row">
              <div className="fc-lab-portal-row__identity">
                <a href={`${playerProfileRoute(row.slug, 'futurecast')}?tab=portal`} className="fc-lab-portal-row__name">
                  {row.name}
                </a>
                <span className="fc-lab-portal-row__meta">
                  {row.position} · Class {row.classYear}
                </span>
              </div>
              <div className="fc-lab-portal-row__metrics">
                <span className="fc-lab-portal-row__portal">Portal {row.portalLikelihood}%</span>
                <span className="fc-lab-portal-row__vol">Vol {row.volatility}</span>
                {row.ufProb != null ? <UfProbBar value={row.ufProb} /> : <span className="rh-cc-empty">—</span>}
                <FitScoreBadge score={row.fitScore} />
              </div>
            </article>
          ))}
        </div>
      )}
    </ModuleShell>
  );
}
