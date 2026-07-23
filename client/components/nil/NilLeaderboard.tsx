'use client';

import React, { useMemo, useState } from 'react';
import { NilPlayerCard } from './NilPlayerCard';
import type { NilEliteBoardPlayer, NilEliteBundle } from '@/lib/nil-elite-api';

type Tab = 'targets' | 'movers' | 'commits';

const TABS: { id: Tab; label: string }[] = [
  { id: 'targets', label: 'UF Targets' },
  { id: 'movers', label: 'Board Heat' },
  { id: 'commits', label: 'UF Commits' },
];

const EMPTY: Record<Tab, string> = {
  targets: 'No active UF targets on the board right now.',
  movers: 'No heated board names in this window.',
  commits: 'No UF commits loaded for this class.',
};

type Props = {
  marketBoard: NilEliteBundle['marketBoard'];
};

export function NilLeaderboard({ marketBoard }: Props): React.ReactElement {
  const [tab, setTab] = useState<Tab>('targets');
  const rows = useMemo((): NilEliteBoardPlayer[] => {
    if (tab === 'movers') return (marketBoard.movers || []).slice(0, 8);
    if (tab === 'commits') return (marketBoard.commits || []).slice(0, 8);
    return (marketBoard.targets || []).slice(0, 8);
  }, [marketBoard, tab]);

  return (
    <section className="nil-elite-section" data-testid="nil-leaderboard">
      <header className="nil-elite-section__head">
        <div>
          <h2 className="nil-elite-section__title">Recruiting NIL board</h2>
          <p className="nil-elite-section__sub">
            Board context beside the money desk — labeled $ only, never invented deals.
          </p>
        </div>
      </header>

      <div className="rh-cc-tabs" role="tablist" aria-label="Market board">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`rh-cc-tabs__btn${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="nil-leaderboard">
        {rows.length === 0 ? (
          <p className="rh-cc-empty">{EMPTY[tab]}</p>
        ) : (
          rows.map((player) => <NilPlayerCard key={player.slug} player={player} />)
        )}
      </div>
    </section>
  );
}
