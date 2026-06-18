'use client';

import React, { useMemo, useState } from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { competingSchoolsFromHighPriority } from '../futurecast-page-utils';
import {
  FitScoreBadge,
  ModuleShell,
  MovementBadge,
  UfProbBar,
  ufPctFromRaw,
} from './primitives';

type Tab = 'battles' | 'lean-uf' | 'lean-elsewhere';

type Props = {
  players: HighPriorityPlayer[];
};

function classifyPlayer(p: HighPriorityPlayer): Tab {
  const pct = ufPctFromRaw(p.ufProbability);
  if (p.committedTo && p.committedTo !== 'Florida') return 'lean-elsewhere';
  if (pct < 40) return 'lean-elsewhere';
  if (pct >= 67) return 'lean-uf';
  return 'battles';
}

function BattleRow({ player }: { player: HighPriorityPlayer }): React.ReactElement {
  const pct = ufPctFromRaw(player.ufProbability);
  const delta = Math.round(player.delta7d ?? player.movementDelta ?? 0);
  const tone = delta > 0 ? 'rise' : delta < 0 ? 'fall' : 'flat';

  return (
    <div className="fc-lab-battle-row">
      <div className="fc-lab-battle-row__identity">
        <a href={playerProfileRoute(player.slug, 'futurecast')} className="fc-lab-battle-row__name">
          {player.name}
        </a>
        <span className="fc-lab-battle-row__meta">
          {player.position} · {competingSchoolsFromHighPriority(player)}
        </span>
        <UfProbBar value={pct} />
      </div>
      <div className="fc-lab-battle-row__right">
        <MovementBadge delta={delta} tone={tone} />
        <FitScoreBadge score={player.fitScore} />
      </div>
    </div>
  );
}

export function FutureCastBattlesPanel({ players }: Props): React.ReactElement {
  const [tab, setTab] = useState<Tab>('battles');

  const buckets = useMemo(() => {
    const result: Record<Tab, HighPriorityPlayer[]> = {
      battles: [],
      'lean-uf': [],
      'lean-elsewhere': [],
    };
    for (const p of players) {
      result[classifyPlayer(p)].push(p);
    }
    for (const key of Object.keys(result) as Tab[]) {
      result[key].sort((a, b) => ufPctFromRaw(b.ufProbability) - ufPctFromRaw(a.ufProbability));
    }
    return result;
  }, [players]);

  const rows = buckets[tab].slice(0, 8);
  const tabLabels: Record<Tab, string> = {
    battles: 'Battles',
    'lean-uf': 'Lean UF',
    'lean-elsewhere': 'Lean Elsewhere',
  };

  return (
    <ModuleShell
      title="Battles & Leaning Targets"
      sub="Contested recruits grouped by FutureCast lean and battle heat."
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
            {tabLabels[id]} ({buckets[id].length})
          </button>
        ))}
      </div>
      <div className="fc-lab-battle-list" role="tabpanel">
        {rows.length === 0 ? (
          <p className="rh-cc-empty">No targets in this bucket yet.</p>
        ) : (
          rows.map((p) => <BattleRow key={p.slug} player={p} />)
        )}
      </div>
    </ModuleShell>
  );
}
