'use client';

import React, { useState } from 'react';
import type { FutureCastPlayer, MovementIntelResponse } from '@/lib/futurecast-board-types';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { ModuleShell, MovementBadge, MovementSparkline, UfProbBar } from './primitives';
import { ufPctFromFc } from './fc-lab-types';

type Tab = 'risers' | 'fallers' | 'volatile';

type Props = {
  movementIntel: MovementIntelResponse;
};

function MovementRow({ player, tone }: { player: FutureCastPlayer; tone: Tab }): React.ReactElement {
  const pct = ufPctFromFc(player.ufConfidence);
  const delta = Math.round(player.trendDelta7d);

  return (
    <div className={`rh-cc-move-row${tone === 'volatile' ? ' rh-cc-move-row--volatile' : ''}`}>
      <div className="rh-cc-move-row__identity">
        <a href={playerProfileRoute(player.slug, 'futurecast')} className="rh-cc-move-row__name">
          {player.name}
        </a>
        <span className="rh-cc-move-row__meta">
          {player.position} · {player.school ?? '—'}
        </span>
        <UfProbBar value={pct} />
      </div>
      <div className="rh-cc-move-row__right">
        <MovementSparkline end={pct} delta={delta} />
        <MovementBadge
          delta={delta}
          tone={tone === 'volatile' ? 'volatile' : delta > 0 ? 'rise' : delta < 0 ? 'fall' : 'flat'}
        />
        {tone === 'volatile' ? (
          <span className="rh-cc-move-row__vol">Volatility: {Math.abs(player.volatility7d)}</span>
        ) : null}
      </div>
    </div>
  );
}

export function FutureCastMovementPanel({ movementIntel }: Props): React.ReactElement {
  const [tab, setTab] = useState<Tab>('risers');

  const rows =
    tab === 'risers'
      ? movementIntel.risers
      : tab === 'fallers'
        ? movementIntel.fallers
        : movementIntel.highVolatility;

  return (
    <ModuleShell
      title="FutureCast Movement — 7-Day Window"
      sub="FutureCast movement window — risers, fallers, and volatile targets."
      action={
        <a href="/vault/futurecast#fc-movement" className="rh-cc-link">
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
        {rows.length === 0 ? (
          <p className="rh-cc-empty">No movement in this bucket yet.</p>
        ) : (
          rows.slice(0, 8).map((item) => <MovementRow key={item.id} player={item} tone={tab} />)
        )}
      </div>
    </ModuleShell>
  );
}
