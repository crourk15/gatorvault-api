'use client';

import React, { useMemo, useState } from 'react';
import type { MasterBoardResponse, TrendingBoardResponse } from '@/lib/futurecast-board-types';
import { playerProfileRoute } from '@/lib/vault-route-map';
import {
  CompetingSchoolsBar,
  FutureCastPanelShell,
  MovementBadge,
  UfProbBar,
} from './primitives';
import { futureCastPlayerToLabTarget, ufPctFromFc } from './fc-lab-types';

type Tab = 'battles' | 'lean-uf' | 'lean-elsewhere';

type Props = {
  masterBoard: MasterBoardResponse;
  trendingBoard: TrendingBoardResponse;
  bare?: boolean;
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
  if (ufPct < 40) return 'lean-elsewhere';
  if (ufPct >= 67) return 'lean-uf';
  return 'battles';
}

function BattleRow({ player, tab }: { player: ReturnType<typeof futureCastPlayerToLabTarget>; tab: Tab }): React.ReactElement {
  const pct = ufPctFromFc(player.ufProbability);
  const delta = Math.round(player.delta7d);
  const tone = delta > 0 ? 'rise' : delta < 0 ? 'fall' : 'flat';
  const meta = TAB_META[tab];

  return (
    <div className="fc-lab-battle-row">
      <div className="fc-lab-battle-row__identity">
        <div className="fc-lab-battle-row__head">
          <a href={playerProfileRoute(player.slug, 'futurecast')} className="fc-lab-battle-row__name">
            {player.name}
          </a>
          <span className={`fc-lab-battle-label ${meta.battleClass}`}>
            <span aria-hidden>{meta.icon}</span> {meta.battleLabel}
          </span>
        </div>
        <span className="fc-lab-battle-row__meta">
          {player.position} · {player.school ?? '—'}
        </span>
        <UfProbBar value={pct} />
        <CompetingSchoolsBar player={player} />
      </div>
      <div className="fc-lab-battle-row__right">
        <MovementBadge delta={delta} tone={tone} />
      </div>
    </div>
  );
}

export function FutureCastBattlesPanel({ masterBoard, trendingBoard, bare }: Props): React.ReactElement {
  const [tab, setTab] = useState<Tab>('battles');

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
    for (const p of pool) {
      const lab = futureCastPlayerToLabTarget(p);
      result[classifyTab(ufPctFromFc(lab.ufProbability))].push(lab);
    }
    for (const key of Object.keys(result) as Tab[]) {
      result[key].sort((a, b) => ufPctFromFc(b.ufProbability) - ufPctFromFc(a.ufProbability));
    }
    return result;
  }, [pool]);

  const rows = buckets[tab].slice(0, 8);

  return (
    <FutureCastPanelShell
      bare={bare}
      title="Battles & Leaning Targets"
      sub="Trending board buckets — battles, lean UF, and lean elsewhere."
      testId="fc-lab-battles"
    >
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
      <div className="fc-lab-battle-list" role="tabpanel">
        {rows.length === 0 ? (
          <p className="rh-cc-empty">No targets in this bucket yet.</p>
        ) : (
          rows.map((p) => <BattleRow key={p.slug} player={p} tab={tab} />)
        )}
      </div>
    </FutureCastPanelShell>
  );
}
