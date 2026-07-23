'use client';

import React, { useMemo, useState } from 'react';
import type { TeamPlayer } from '@/lib/team-hub-types';
import {
  rosterMatchesFilter,
  resolveRosterPositionGroup,
  type RosterFilter,
  type RosterPositionGroup,
} from '@/lib/roster-position-groups';
import { playerProfilePath } from '@/lib/player-routes';
import { PlayerNavLink } from '@/components/vault/PlayerNavLink';

export type RosterViewMode = 'starters' | 'full';

type Props = {
  players: TeamPlayer[];
  filter: RosterFilter;
  viewMode: RosterViewMode;
};

const GROUP_ORDER: RosterPositionGroup[] = ['QB', 'RB', 'WR', 'OL', 'DL', 'LB', 'DB', 'ST'];

const GROUP_LABEL: Record<RosterPositionGroup, string> = {
  QB: 'Quarterbacks',
  RB: 'Running backs',
  WR: 'Receivers & tight ends',
  OL: 'Offensive line',
  DL: 'Defensive line',
  LB: 'Linebackers',
  DB: 'Secondary',
  ST: 'Special teams',
};

const FULL_ROOM_PREVIEW = 4;

function isStarter(p: TeamPlayer): boolean {
  return (p.tags ?? []).some((t) => t.toLowerCase() === 'starter');
}

function sortPlayers(list: TeamPlayer[]): TeamPlayer[] {
  return [...list].sort((a, b) => {
    const sa = isStarter(a) ? 0 : 1;
    const sb = isStarter(b) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });
}

function hometownLine(player: TeamPlayer): string {
  const raw = String(player.hometown || '').trim();
  // Prefer short school/city — avoid giant "City, St. High School" overflow.
  if (!raw) return player.state?.trim() || '';
  // Keep first segment before a long school suffix when possible
  if (raw.length <= 42) return raw;
  const comma = raw.indexOf(',');
  if (comma > 0 && comma <= 36) return raw.slice(0, comma).trim();
  return `${raw.slice(0, 39).trim()}…`;
}

function PlayerCard({ player }: { player: TeamPlayer }): React.ReactElement {
  const href = player.slug
    ? playerProfilePath(player.slug, 'ROSTER', true, player.name, 'roster')
    : undefined;
  const starter = isStarter(player);
  const place = hometownLine(player);

  const body = (
    <>
      <div className="gv-team-roster-card__top">
        <span className="gv-team-roster-card__pos">{player.position || '—'}</span>
        {starter ? <span className="gv-team-roster-card__starter">Starter</span> : null}
      </div>
      <p className="gv-team-roster-card__name">{player.name}</p>
      <p className="gv-team-roster-card__class">{player.classYear || '—'}</p>
      {place ? <p className="gv-team-roster-card__meta">{place}</p> : null}
    </>
  );

  if (href) {
    return (
      <PlayerNavLink href={href} className={`gv-team-roster-card${starter ? ' is-starter' : ''}`}>
        {body}
      </PlayerNavLink>
    );
  }

  return <article className={`gv-team-roster-card${starter ? ' is-starter' : ''}`}>{body}</article>;
}

function RoomSection({
  id,
  label,
  players,
  viewMode,
}: {
  id: string;
  label: string;
  players: TeamPlayer[];
  viewMode: RosterViewMode;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const visible =
    viewMode === 'starters'
      ? players
      : expanded || players.length <= FULL_ROOM_PREVIEW
        ? players
        : players.slice(0, FULL_ROOM_PREVIEW);
  const hidden = viewMode === 'full' ? Math.max(0, players.length - visible.length) : 0;

  return (
    <section className="gv-team-roster-room" aria-labelledby={`roster-room-${id}`}>
      <header className="gv-team-roster-room__head">
        <h3 id={`roster-room-${id}`} className="gv-team-roster-room__title">
          {label}
        </h3>
        <span className="gv-team-roster-room__count">{players.length}</span>
      </header>
      <div className="gv-team-roster-grid">
        {visible.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>
      {hidden > 0 ? (
        <button
          type="button"
          className="gv-team-roster-room__more"
          onClick={() => setExpanded(true)}
        >
          Show {hidden} more in {label}
        </button>
      ) : null}
      {viewMode === 'full' && expanded && players.length > FULL_ROOM_PREVIEW ? (
        <button
          type="button"
          className="gv-team-roster-room__more gv-team-roster-room__more--collapse"
          onClick={() => setExpanded(false)}
        >
          Show fewer
        </button>
      ) : null}
    </section>
  );
}

export function RosterList({ players, filter, viewMode }: Props): React.ReactElement {
  const filtered = useMemo(() => {
    const base = players.filter((p) => rosterMatchesFilter(p.position, filter, p.positionGroup));
    const scoped = viewMode === 'starters' ? base.filter(isStarter) : base;
    return sortPlayers(scoped);
  }, [players, filter, viewMode]);

  const rooms = useMemo(() => {
    const map = new Map<RosterPositionGroup, TeamPlayer[]>();
    for (const p of filtered) {
      const g = resolveRosterPositionGroup(p.position, p.positionGroup);
      if (!g) continue;
      const list = map.get(g) ?? [];
      list.push(p);
      map.set(g, list);
    }
    const order = filter === 'All' ? GROUP_ORDER : GROUP_ORDER.filter((g) => g === filter);
    return order
      .map((g) => ({
        id: g,
        label: GROUP_LABEL[g],
        players: sortPlayers(map.get(g) ?? []),
      }))
      .filter((room) => room.players.length > 0);
  }, [filtered, filter]);

  if (filtered.length === 0) {
    return (
      <p className="gv-team-status">
        {viewMode === 'starters'
          ? 'No tagged starters in this room yet. Switch to Full roster to browse the class.'
          : 'No players match this filter.'}
      </p>
    );
  }

  return (
    <div className="gv-team-roster-rooms">
      {rooms.map((room) => (
        <RoomSection
          key={room.id}
          id={room.id}
          label={room.label}
          players={room.players}
          viewMode={viewMode}
        />
      ))}
    </div>
  );
}
