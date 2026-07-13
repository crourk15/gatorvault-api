'use client';

import React, { useMemo, useState } from 'react';
import type { MasterBoardResponse, TrendingBoardResponse } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { FutureCastPanelShell, MovementBadge } from './primitives';
import {
  futureCastPlayerToLabTarget,
  highPriorityToLabTarget,
  movementDeltasAreBelievable,
  ufPctFromFc,
} from './fc-lab-types';
import { useFutureCastLabCycle } from './FutureCastLabCycleContext';

type Tab = 'battles' | 'lean-uf' | 'lean-elsewhere';

type Props = {
  masterBoard: MasterBoardResponse;
  trendingBoard: TrendingBoardResponse;
  highPriority?: HighPriorityPlayer[];
  bare?: boolean;
  /** Name + odds strip — no second full market board. */
  compact?: boolean;
};

const TAB_META: Record<Tab, { label: string; icon: string; battleClass: string; battleLabel: string }> = {
  battles: { label: 'Battles', icon: '⚠️', battleClass: 'fc-lab-battle-label--battle', battleLabel: 'Battle' },
  'lean-uf': { label: 'Lean UF', icon: '🟦', battleClass: 'fc-lab-battle-label--uf', battleLabel: 'Lean UF' },
  'lean-elsewhere': {
    label: 'Lean Elsewhere',
    icon: '🔴',
    battleClass: 'fc-lab-battle-label--other',
    battleLabel: 'Lean Other',
  },
};

function classifyTab(ufPct: number): Tab {
  if (ufPct >= 67) return 'lean-uf';
  if (ufPct >= 34) return 'battles';
  return 'lean-elsewhere';
}

function BattleRowCompact({
  player,
  tab,
  showMovement,
}: {
  player: ReturnType<typeof futureCastPlayerToLabTarget>;
  tab: Tab;
  showMovement: boolean;
}): React.ReactElement {
  const pct = ufPctFromFc(player.ufProbability);
  const delta = showMovement ? Math.round(player.delta7d ?? 0) : 0;
  const tone = delta > 0 ? 'rise' : delta < 0 ? 'fall' : 'flat';
  const meta = TAB_META[tab];

  return (
    <a
      href={playerProfileRoute(player.slug, 'futurecast')}
      className="fc-lab-battle-row fc-lab-battle-row--compact"
    >
      <div className="fc-lab-battle-row__identity">
        <div className="fc-lab-battle-row__head">
          <span className="fc-lab-battle-row__name">{player.name}</span>
          <span className={`fc-lab-battle-label ${meta.battleClass}`}>
            <span aria-hidden>{meta.icon}</span> {meta.battleLabel}
          </span>
        </div>
        <span className="fc-lab-battle-row__meta">
          {player.position} · {player.school ?? '—'}
        </span>
      </div>
      <div className="fc-lab-battle-row__right">
        <strong className="fc-lab-battle-row__pct">{pct}%</strong>
        {showMovement && delta !== 0 ? <MovementBadge delta={delta} tone={tone} /> : null}
      </div>
    </a>
  );
}

export function FutureCastBattlesPanel({
  masterBoard,
  trendingBoard,
  highPriority = [],
  bare,
  compact = true,
}: Props): React.ReactElement | null {
  const [tab, setTab] = useState<Tab>('battles');
  const { discoveryView: discoveryFocus } = useFutureCastLabCycle();
  const focusYear = discoveryFocus ? 2028 : 2027;

  const pool = useMemo(() => {
    const merged = [
      ...masterBoard.players,
      ...trendingBoard.trendingUp,
      ...trendingBoard.trendingDown,
      ...masterBoard.movementSummary.volatilePlayers,
    ];
    const seen = new Set<string>();
    return merged.filter((p) => {
      if (seen.has(p.slug)) return false;
      seen.add(p.slug);
      return true;
    });
  }, [masterBoard, trendingBoard]);

  const buckets = useMemo(() => {
    const result: Record<Tab, ReturnType<typeof futureCastPlayerToLabTarget>[]> = {
      battles: [],
      'lean-uf': [],
      'lean-elsewhere': [],
    };
    if (discoveryFocus && highPriority.length) {
      for (const p of highPriority) {
        const lab = highPriorityToLabTarget(p);
        result[classifyTab(ufPctFromFc(lab.ufProbability))].push(lab);
      }
    } else {
      for (const p of pool) {
        const lab = futureCastPlayerToLabTarget(p);
        result[classifyTab(ufPctFromFc(lab.ufProbability))].push(lab);
      }
    }
    for (const key of Object.keys(result) as Tab[]) {
      result[key].sort((a, b) => ufPctFromFc(b.ufProbability) - ufPctFromFc(a.ufProbability));
    }
    return result;
  }, [discoveryFocus, highPriority, pool]);

  const rows = buckets[tab].slice(0, 8);
  const showMovement = useMemo(
    () => movementDeltasAreBelievable(Object.values(buckets).flat()),
    [buckets]
  );

  const totalRows =
    buckets.battles.length + buckets['lean-uf'].length + buckets['lean-elsewhere'].length;
  if (totalRows === 0) return null;

  const title = discoveryFocus ? `${focusYear} Battles` : 'Battles';
  const sub = compact
    ? 'Chase buckets — name and Florida odds only'
    : 'Battle · leaning Florida · leaning elsewhere';

  return (
    <FutureCastPanelShell bare={bare} title={title} sub={sub} testId="fc-lab-battles">
      <div className="rh-cc-tabs" role="tablist" aria-label="Battle categories">
        {(['battles', 'lean-uf', 'lean-elsewhere'] as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`rh-cc-tabs__btn${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {TAB_META[id].icon} {TAB_META[id].label} ({buckets[id].length})
          </button>
        ))}
      </div>
      <div className={`fc-lab-battle-list${compact ? ' fc-lab-battle-list--compact' : ''}`} role="tabpanel">
        {rows.length === 0 ? (
          <p className="rh-cc-empty">
            {discoveryFocus
              ? `No ${focusYear} targets in this bucket yet.`
              : 'No targets in this bucket yet.'}
          </p>
        ) : (
          rows.map((p) => (
            <BattleRowCompact key={p.slug} player={p} tab={tab} showMovement={showMovement} />
          ))
        )}
      </div>
    </FutureCastPanelShell>
  );
}
