'use client';

import React, { useEffect, useState } from 'react';
import type { MovementIntelItem } from '@/lib/movement-intel-types';
import { movementDelta7d } from '@/lib/movement-intel-types';
import { fetchHomeMovementIntel, type HomeMovementIntelData } from '@/lib/vault-home-api';
import { playerProfilePath } from '@/lib/player-routes';
import { ModuleShell, MovementBadge, MovementSparkline, UfProbBar, ufPctFromRaw } from './primitives';

type Tab = 'risers' | 'fallers' | 'volatile';

function playerHref(item: MovementIntelItem): string {
  return playerProfilePath(item.slug || item.id, 'HIGH_SCHOOL', true, item.name, 'futurecast');
}

function MovementRow({ item, tone }: { item: MovementIntelItem; tone: Tab }): React.ReactElement {
  const delta = movementDelta7d(item);
  const pct = ufPctFromRaw(item.ufProb);

  return (
    <div className={`rh-cc-move-row${tone === 'volatile' ? ' rh-cc-move-row--volatile' : ''}`}>
      <div className="rh-cc-move-row__identity">
        <a href={playerHref(item)} className="rh-cc-move-row__name">
          {item.name}
        </a>
        <span className="rh-cc-move-row__meta">
          {item.position} · {item.school}
        </span>
        <UfProbBar value={pct} />
      </div>
      <div className="rh-cc-move-row__right">
        <MovementSparkline end={pct} delta={delta} />
        <MovementBadge
          delta={delta}
          tone={tone === 'volatile' ? 'volatile' : delta > 0 ? 'rise' : delta < 0 ? 'fall' : 'flat'}
        />
      </div>
    </div>
  );
}

type Props = {
  initialData?: HomeMovementIntelData | null;
};

export function FutureCastMovementPanel({ initialData }: Props): React.ReactElement {
  const [tab, setTab] = useState<Tab>('risers');
  const [data, setData] = useState<HomeMovementIntelData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      return;
    }
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
  }, [initialData]);

  const rows =
    tab === 'risers' ? data?.risers ?? [] : tab === 'fallers' ? data?.fallers ?? [] : data?.volatile ?? [];

  return (
    <ModuleShell
      title="FutureCast Movement — 7-Day Window"
      sub="Risers, fallers, and volatile targets — replaces the Movement Intel page."
      action={
        <a href="/vault/futurecast/movement" className="rh-cc-link">
          Full movement intel →
        </a>
      }
      testId="fc-lab-movement"
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
