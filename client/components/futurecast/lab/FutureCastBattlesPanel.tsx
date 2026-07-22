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
import { closingClassUrgencyScore, isClosingClassInPlayTarget, topThreatVsFlorida } from './competing-schools';
import { isActiveUfTarget } from '@/lib/recruiting-target-filters';

type Tab = 'battles' | 'lean-uf' | 'lean-elsewhere';

type Props = {
  masterBoard: MasterBoardResponse;
  trendingBoard: TrendingBoardResponse;
  highPriority?: HighPriorityPlayer[];
  bare?: boolean;
  /** Name + odds strip — no second full market board. */
  compact?: boolean;
};

const TAB_META: Record<Tab, { label: string; battleClass: string; battleLabel: string; empty: string }> = {
  battles: {
    label: 'Battles',
    battleClass: 'fc-lab-battle-label--battle',
    battleLabel: 'Battle',
    empty: 'No open battles on the board yet. Check Lean UF or Lean Elsewhere.',
  },
  'lean-uf': {
    label: 'Lean UF',
    battleClass: 'fc-lab-battle-label--uf',
    battleLabel: 'Lean UF',
    empty: 'No Florida leans at 67%+ right now — open Battles for the live fights.',
  },
  'lean-elsewhere': {
    label: 'Lean Elsewhere',
    battleClass: 'fc-lab-battle-label--other',
    battleLabel: 'Lean Other',
    empty: 'No lean-elsewhere targets on the board yet.',
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
  const threat = topThreatVsFlorida(player);

  return (
    <a
      href={playerProfileRoute(player.slug, 'futurecast')}
      className="fc-lab-battle-row fc-lab-battle-row--compact"
    >
      <div className="fc-lab-battle-row__identity">
        <span className="fc-lab-battle-row__name">{player.name}</span>
        <span className="fc-lab-battle-row__meta">
          {player.position} · {player.school ?? '—'}
        </span>
      </div>
      <span className={`fc-lab-battle-label ${meta.battleClass}`}>{meta.battleLabel}</span>
      <span className="fc-lab-battle-row__rival">
        {threat ? (
          <>
            <span className="fc-lab-battle-row__rival-label">vs</span> {threat.label}{' '}
            <strong>{threat.pct}%</strong>
          </>
        ) : (
          <span className="fc-lab-battle-row__rival-empty">—</span>
        )}
      </span>
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
}: Props): React.ReactElement {
  const [tabOverride, setTabOverride] = useState<Tab | null>(null);
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
        if (!isActiveUfTarget(p)) continue;
        if (Number(p.classYear) !== focusYear) continue;
        const lab = highPriorityToLabTarget(p);
        if (lab.ufProbability == null) continue;
        result[classifyTab(ufPctFromFc(lab.ufProbability))].push(lab);
      }
    } else {
      for (const p of pool) {
        if (!isActiveUfTarget(p)) continue;
        const lab = futureCastPlayerToLabTarget(p);
        if (lab.ufProbability == null) continue;
        // Closing class: only show in-play UF fights in Battles/Lean UF;
        // lean-elsewhere keeps real longshots that still have known odds.
        if (!isClosingClassInPlayTarget(lab) && classifyTab(ufPctFromFc(lab.ufProbability)) !== 'lean-elsewhere') {
          continue;
        }
        result[classifyTab(ufPctFromFc(lab.ufProbability))].push(lab);
      }
    }
    for (const key of Object.keys(result) as Tab[]) {
      result[key].sort((a, b) => closingClassUrgencyScore(b) - closingClassUrgencyScore(a));
    }
    return result;
  }, [discoveryFocus, highPriority, pool, focusYear]);

  // Prefer opening on a non-empty bucket so fans don't land on a blank Battles tab.
  const preferredTab = useMemo((): Tab => {
    if (buckets.battles.length) return 'battles';
    if (buckets['lean-uf'].length) return 'lean-uf';
    if (buckets['lean-elsewhere'].length) return 'lean-elsewhere';
    return 'battles';
  }, [buckets]);

  const tab = tabOverride ?? preferredTab;
  const rows = buckets[tab].slice(0, 8);
  const showMovement = useMemo(
    () => movementDeltasAreBelievable(Object.values(buckets).flat()),
    [buckets]
  );

  const totalRows =
    buckets.battles.length + buckets['lean-uf'].length + buckets['lean-elsewhere'].length;

  const title = discoveryFocus ? `${focusYear} Battles` : 'Battles';
  const sub = compact
    ? 'Name · lean · top rival · Florida %'
    : 'Battle · leaning Florida · leaning elsewhere';

  // Never vanish — fans need the Battles slot even when RPM/board odds are thin.
  if (totalRows === 0) {
    return (
      <FutureCastPanelShell bare={bare} title={title} sub={sub} testId="fc-lab-battles">
        <p className="rh-cc-empty">
          {discoveryFocus
            ? `Battle odds for the ${focusYear} board refresh when Florida percentages land.`
            : 'Battle odds refresh when Florida percentages land on the board.'}
        </p>
      </FutureCastPanelShell>
    );
  }

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
            onClick={() => setTabOverride(id)}
          >
            {TAB_META[id].label} ({buckets[id].length})
          </button>
        ))}
      </div>
      <div className={`fc-lab-battle-list${compact ? ' fc-lab-battle-list--compact' : ''}`} role="tabpanel">
        {compact && rows.length > 0 ? (
          <div className="fc-lab-battle-list__cols" aria-hidden="true">
            <span>Name</span>
            <span>Lean</span>
            <span>Rival</span>
            <span>UF %</span>
          </div>
        ) : null}
        {rows.length === 0 ? (
          <p className="rh-cc-empty fc-lab-battle-empty">{TAB_META[tab].empty}</p>
        ) : (
          rows.map((p) => (
            <BattleRowCompact key={p.slug} player={p} tab={tab} showMovement={showMovement} />
          ))
        )}
      </div>
    </FutureCastPanelShell>
  );
}
