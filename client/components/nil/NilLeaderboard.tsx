'use client';

import React, { useMemo, useState } from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { NilPlayerCard } from './NilPlayerCard';
import { sortNilPlayers, type NilLeaderboardTab } from './nil-sort';

const TABS: { id: NilLeaderboardTab; label: string }[] = [
  { id: 'top', label: 'Top Earners' },
  { id: 'rising', label: 'Rising Value' },
  { id: 'targets', label: 'UF Targets' },
  { id: 'movers', label: 'Biggest Movers' },
];

const EMPTY_COPY: Record<NilLeaderboardTab, string> = {
  top: 'No player valuations loaded.',
  rising: 'No rising valuations on the board yet.',
  targets: 'No active UF targets on the board right now.',
  movers: 'No large board movers in this window.',
};

type Props = {
  players: HighPriorityPlayer[];
};

export function NilLeaderboard({ players }: Props): React.ReactElement {
  const [tab, setTab] = useState<NilLeaderboardTab>('top');
  const rows = useMemo(() => sortNilPlayers(players, tab).slice(0, 12), [players, tab]);

  return (
    <section className="nil-elite-section" data-testid="nil-leaderboard">
      <header className="nil-elite-section__head">
        <div>
          <h2 className="nil-elite-section__title">Player NIL Leaderboard</h2>
          <p className="nil-elite-section__sub">
            Modeled valuations and board trends for high-priority names. Tap a row for the FutureCast
            profile.
          </p>
        </div>
      </header>

      <div className="rh-cc-tabs" role="tablist" aria-label="Leaderboard sort">
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
          <p className="rh-cc-empty">{EMPTY_COPY[tab]}</p>
        ) : (
          rows.map((player) => <NilPlayerCard key={player.slug} player={player} />)
        )}
      </div>
    </section>
  );
}
