'use client';

import React, { useState } from 'react';
import type { HomeMovementIntelData } from '@/lib/vault-home-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { movementDelta7d } from '@/lib/movement-intel-types';
import { playerHref } from '@/lib/player-link';
import { SITE_ROUTES } from '@/lib/site-routes';
import { HomeMiniSparkline } from './widgets/HomeMiniSparkline';

type Tab = 'risers' | 'fallers' | 'volatile';

type Props = {
  movementIntel: HomeMovementIntelData | null;
  movement: StaffDashboardResponse | null;
  loading?: boolean;
};

function staffDelta(p: { delta?: number; delta7d?: number }): number {
  return p.delta7d ?? p.delta ?? 0;
}

export function HomeMovementIntelPreview({ movementIntel, movement, loading }: Props): React.ReactElement {
  const [tab, setTab] = useState<Tab>('risers');

  if (loading) {
    return (
      <section className="gv-hcc-section gv-hcc-skeleton" style={{ minHeight: 220 }} aria-hidden />
    );
  }

  const risers =
    movementIntel?.risers?.slice(0, 4) ??
    movement?.topRisers?.slice(0, 4).map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      ufProb: 0,
      delta: staffDelta(p),
      movementType: 'RISE' as const,
      position: '',
      school: '',
      lastUpdate: '',
      tags: [],
    })) ??
    [];
  const fallers =
    movementIntel?.fallers?.slice(0, 4) ??
    movement?.topFallers?.slice(0, 4).map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      ufProb: 0,
      delta: staffDelta(p),
      movementType: 'FALL' as const,
      position: '',
      school: '',
      lastUpdate: '',
      tags: [],
    })) ??
    [];
  const volatile =
    movementIntel?.volatile?.slice(0, 4) ??
    movement?.highVolatility?.slice(0, 4).map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      ufProb: 0,
      delta: staffDelta(p),
      movementType: 'VOLATILE' as const,
      position: '',
      school: '',
      lastUpdate: '',
      tags: [],
    })) ??
    [];

  const lists: Record<Tab, typeof risers> = { risers, fallers, volatile };
  const active = lists[tab];

  return (
    <section className="gv-hcc-section" aria-label="Movement intel preview" data-testid="home-movement-preview">
      <header className="gv-hcc-section__head">
        <h2 className="gv-hcc-section__title">Movement Intel</h2>
      </header>
      <div className="gv-hcc-tabs no-scrollbar" role="tablist">
        {(
          [
            ['risers', 'Risers'],
            ['fallers', 'Fallers'],
            ['volatile', 'Volatile'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`gv-hcc-tabs__btn${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="gv-hcc-move-list" role="tabpanel">
        {active.map((item) => {
          const delta = movementDelta7d(item);
          const uf = item.ufProb <= 1 ? Math.round(item.ufProb * 100) : Math.round(item.ufProb);
          const tone = tab === 'risers' ? 'up' : tab === 'fallers' ? 'down' : 'hot';
          return (
            <li key={item.id}>
              <a
                href={playerHref({ slug: item.slug, id: item.id, name: item.name }, 'recruiting', 'HIGH_SCHOOL')}
                className="gv-hcc-move-row"
              >
                <span className="gv-hcc-move-row__name">{item.name}</span>
                <span className="gv-hcc-move-row__meta">
                  UF {uf}% · {delta >= 0 ? '+' : ''}
                  {delta}%
                </span>
                <HomeMiniSparkline
                  values={[uf - delta, uf - delta * 0.5, uf]}
                  tone={tone === 'up' ? 'up' : tone === 'down' ? 'down' : 'hot'}
                />
              </a>
            </li>
          );
        })}
        {active.length === 0 && <li className="gv-hcc-widget__meta">No movement in this window.</li>}
      </ul>
      <a href={`${SITE_ROUTES.recruiting}#movement`} className="gv-hcc-section__cta">
        Full Movement Intel →
      </a>
    </section>
  );
}
