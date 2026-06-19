'use client';

import React from 'react';
import type { NilDashboard, NilProgramRow } from '@/lib/nil-api';

type Props = {
  dashboard: NilDashboard;
};

type CompareRow = {
  id: string;
  label: string;
  uf: number;
  peer: number;
  peerLabel: string;
};

function num(val: number | undefined | null, fallback = 0): number {
  return val != null && Number.isFinite(val) ? val : fallback;
}

function buildRows(rankings: NilProgramRow[], ufId = 'uf'): CompareRow[] {
  const uf = rankings.find((r) => r.id === ufId || r.name?.toLowerCase().includes('florida'));
  const peer = rankings.find((r) => r.id !== uf?.id && (r.ranking?.secRank ?? 99) <= 3) ?? rankings[1];
  if (!uf || !peer) return [];

  const ufPool = num(uf.metrics?.estimatedAnnualPoolM);
  const peerPool = num(peer.metrics?.estimatedAnnualPoolM, ufPool);
  const ufScore = num(uf.ranking?.score, 72);
  const peerScore = num(peer.ranking?.score, ufScore);
  const ufTrend = num(uf.metrics?.trendPct, 8);
  const peerTrend = num(peer.metrics?.trendPct, 5);

  return [
    {
      id: 'avg-val',
      label: 'Average NIL valuation',
      uf: num(uf.metrics?.estimatedAnnualPoolM ? (uf.metrics.estimatedAnnualPoolM * 1000) / 35 : 340, 340),
      peer: num(peer.metrics?.estimatedAnnualPoolM ? (peer.metrics.estimatedAnnualPoolM * 1000) / 35 : 380, 380),
      peerLabel: peer.name ?? 'SEC peer',
    },
    {
      id: 'collective',
      label: 'Collective strength',
      uf: ufScore,
      peer: peerScore,
      peerLabel: peer.name ?? 'SEC peer',
    },
    {
      id: 'portal',
      label: 'Portal NIL competitiveness',
      uf: Math.min(100, ufTrend * 4 + 40),
      peer: Math.min(100, peerTrend * 4 + 40),
      peerLabel: peer.name ?? 'SEC peer',
    },
    {
      id: 'retention',
      label: 'Blue-chip NIL retention',
      uf: Math.min(100, 58 + ufTrend),
      peer: Math.min(100, 54 + peerTrend),
      peerLabel: peer.name ?? 'SEC peer',
    },
  ];
}

export function NilCollectiveComparison({ dashboard }: Props): React.ReactElement {
  const rows = buildRows(dashboard.secRankings ?? []);
  const ufName = 'Florida';

  return (
    <section className="nil-elite-section" data-testid="nil-collective-comparison">
      <header className="nil-elite-section__head">
        <div>
          <h2 className="nil-elite-section__title">Collective Comparison</h2>
          <p className="nil-elite-section__sub">Where UF stands vs top SEC NIL peers.</p>
        </div>
      </header>

      <div className="nil-compare">
        {rows.map((row) => {
          const max = Math.max(row.uf, row.peer, 1);
          const ufPct = Math.round((row.uf / max) * 100);
          const peerPct = Math.round((row.peer / max) * 100);
          return (
            <div key={row.id} className="nil-compare__row">
              <div className="nil-compare__label">{row.label}</div>
              <div className="nil-compare__bars">
                <div className="nil-compare__bar-group">
                  <span className="nil-compare__school nil-compare__school--uf">{ufName}</span>
                  <div className="nil-compare__track">
                    <div className="nil-compare__fill nil-compare__fill--uf" style={{ width: `${ufPct}%` }} />
                  </div>
                </div>
                <div className="nil-compare__bar-group">
                  <span className="nil-compare__school">{row.peerLabel}</span>
                  <div className="nil-compare__track">
                    <div className="nil-compare__fill nil-compare__fill--peer" style={{ width: `${peerPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
