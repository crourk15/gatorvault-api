'use client';

import React, { useEffect, useState } from 'react';
import type { MovementIntelItem, MovementIntelResponse } from '@/lib/movement-intel-types';
import { movementDelta7d } from '@/lib/movement-intel-types';
import { fetchHomeMovementIntel } from '@/lib/vault-home-api';
import { playerHref } from '@/lib/player-link';
import { ModuleShell, MovementBadge, MovementSparkline, UfProbBar, ufPctFromRaw } from './primitives';

type Tab = 'risers' | 'fallers' | 'volatile';

function profileHref(item: MovementIntelItem): string {
  return playerHref({ slug: item.slug, id: item.id, name: item.name }, 'recruiting', 'HIGH_SCHOOL');
}

function MovementRow({ item, tone }: { item: MovementIntelItem; tone: Tab }): React.ReactElement {
  const delta = movementDelta7d(item);
  const pct = ufPctFromRaw(item.ufProb);
  return (
    <div className={`rh-cc-move-row${tone === 'volatile' ? ' rh-cc-move-row--volatile' : ''}`}>
      <div className="rh-cc-move-row__identity">
        <a href={profileHref(item)} className="rh-cc-move-row__name">
          {item.name}
        </a>
        <span className="rh-cc-move-row__meta">
          {item.position} · {item.school}
        </span>
        <UfProbBar value={pct} />
      </div>
      <div className="rh-cc-move-row__right">
        {pct == null ? (
          <span className="rh-cc-move-row__vol">RPM pending</span>
        ) : (
          <MovementSparkline end={pct} delta={delta} />
        )}
        <MovementBadge
          delta={delta}
          tone={tone === 'volatile' ? 'volatile' : delta > 0 ? 'rise' : delta < 0 ? 'fall' : 'flat'}
        />
        {tone === 'volatile' ? (
          <span className="rh-cc-move-row__vol">Volatility: {Math.abs(delta) || '—'}</span>
        ) : null}
      </div>
    </div>
  );
}

export function MovementIntelPanel(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('risers');
  const [data, setData] = useState<MovementIntelResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchHomeMovementIntel()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows =
    tab === 'risers' ? data?.risers ?? [] : tab === 'fallers' ? data?.fallers ?? [] : data?.volatile ?? [];

  return (
    <ModuleShell
      title="Who's moving — Risers, Fallers, Volatile"
      action={
        <a href="/vault/recruiting/movement" className="rh-cc-link">
          See all board movement →
        </a>
      }
      testId="rh-cc-movement-intel"
    >
      <div className="rh-cc-tabs" role="tablist" aria-label="Movement categories">
        {(['risers', 'fallers', 'volatile'] as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`rh-cc-tabs__btn${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {id === 'risers' ? 'Risers' : id === 'fallers' ? 'Fallers' : 'Volatile'}
          </button>
        ))}
      </div>
      <div className="rh-cc-move-list" role="tabpanel">
        {loading && !data ? (
          <div className="rh-cc-skeleton" aria-hidden />
        ) : rows.length === 0 ? (
          <p className="rh-cc-empty">No movement in this bucket yet.</p>
        ) : (
          rows.slice(0, 8).map((item) => <MovementRow key={item.id} item={item} tone={tab} />)
        )}
      </div>
    </ModuleShell>
  );
}
