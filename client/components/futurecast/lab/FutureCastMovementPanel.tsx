'use client';

import React, { useMemo, useState } from 'react';
import type { FutureCastPlayer, MovementIntelResponse } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { UnderclassmenPlayer } from '@/lib/futurecast-underclassmen-api';
import { futureCastLabHref, FUTURECAST_LAB_ANCHORS, playerProfileRoute } from '@/lib/vault-route-map';
import { FutureCastPanelShell, MovementBadge, MovementSparkline, UfProbBar } from './primitives';
import { discoveryMovementBuckets, ufPctFromFc } from './fc-lab-types';
import { useFutureCastLabCycle } from './FutureCastLabCycleContext';

type Tab = 'risers' | 'fallers' | 'volatile';

type Props = {
  movementIntel: MovementIntelResponse;
  highPriority?: HighPriorityPlayer[];
  underclassmen?: UnderclassmenPlayer[];
  bare?: boolean;
};

function MovementRow({ player, tone }: { player: FutureCastPlayer; tone: Tab }): React.ReactElement {
  const pct = ufPctFromFc(player.ufConfidence);
  const delta = Math.round(player.trendDelta7d ?? 0);

  return (
    <div className={`rh-cc-move-row${tone === 'volatile' ? ' rh-cc-move-row--volatile' : ''}`}>
      <div className="rh-cc-move-row__identity">
        <a href={playerProfileRoute(player.slug, 'futurecast')} className="rh-cc-move-row__name">
          {player.name}
        </a>
        <span className="rh-cc-move-row__meta">
          {player.position} · {player.school ?? '—'}
        </span>
        <span className="fc-lab-battle-row__metric-label">GatorVault · Florida odds</span>
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

export function FutureCastMovementPanel({
  movementIntel,
  highPriority = [],
  underclassmen = [],
  bare,
}: Props): React.ReactElement {
  const [tab, setTab] = useState<Tab>('risers');
  const { discoveryView: discoveryFocus } = useFutureCastLabCycle();
  const focusYear = discoveryFocus ? 2028 : 2027;
  const discoveryBuckets = useMemo(
    () => discoveryMovementBuckets(underclassmen, highPriority),
    [underclassmen, highPriority]
  );

  const rows = discoveryFocus
    ? tab === 'risers'
      ? discoveryBuckets.risers
      : tab === 'fallers'
        ? discoveryBuckets.fallers
        : discoveryBuckets.highVolatility
    : tab === 'risers'
      ? movementIntel.risers
      : tab === 'fallers'
        ? movementIntel.fallers
        : movementIntel.highVolatility;

  const title = discoveryFocus
    ? `${focusYear} Discovery Movement`
    : 'FutureCast Movement — 7-Day Window';
  const sub = discoveryFocus
    ? discoveryBuckets.believable
      ? 'Real week-over-week GatorVault Florida-odds movers on the allowlist.'
      : 'Waiting on varied week-over-week Florida-odds changes — uniform board bumps stay hidden.'
    : 'FutureCast movement window — risers, fallers, and volatile targets.';

  const emptyCopy = discoveryFocus
    ? discoveryBuckets.believable
      ? `No ${focusYear} movement in this bucket yet.`
      : `No reliable ${focusYear} weekly movers yet — deltas populate once snapshots diverge.`
    : 'No movement in this bucket yet.';

  return (
    <FutureCastPanelShell
      bare={bare}
      title={title}
      sub={sub}
      action={
        <a href={futureCastLabHref(FUTURECAST_LAB_ANCHORS.movement)} className="rh-cc-link">
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
          <p className="rh-cc-empty">{emptyCopy}</p>
        ) : (
          rows.slice(0, 8).map((item) => <MovementRow key={item.id} player={item} tone={tab} />)
        )}
      </div>
    </FutureCastPanelShell>
  );
}
