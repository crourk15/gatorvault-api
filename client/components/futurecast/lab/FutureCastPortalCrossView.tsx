'use client';

import React, { useMemo } from 'react';
import type { MasterBoardResponse } from '@/lib/futurecast-board-types';
import type { PortalWatchlistHomePlayer } from '@/lib/futurecast-home-api';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { FitScoreBadge, ModuleShell, UfProbBar } from './primitives';
import { ufPctFromFc } from './fc-lab-types';

type Props = {
  portalPlayers: PortalWatchlistHomePlayer[];
  masterBoard: MasterBoardResponse;
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

export function FutureCastPortalCrossView({ portalPlayers, masterBoard }: Props): React.ReactElement {
  const boardBySlug = useMemo(
    () => new Map(masterBoard.players.map((p) => [p.slug, p])),
    [masterBoard]
  );

  const rows = useMemo((): CrossRow[] => {
    return portalPlayers.slice(0, 10).map((p) => {
      const board = boardBySlug.get(p.slug);
      return {
        id: p.id,
        slug: p.slug,
        name: p.fullName,
        position: p.position,
        classYear: p.classYear,
        portalLikelihood: Math.round(p.portalLikelihood),
        volatility: Math.round(p.volatility),
        ufProb: board ? ufPctFromFc(board.ufConfidence) : null,
        fitScore: board?.fitScore ?? null,
      };
    });
  }, [portalPlayers, boardBySlug]);

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
