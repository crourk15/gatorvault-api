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

type Props = {
  players: TeamPlayer[];
  filter: RosterFilter;
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

function isStarter(p: TeamPlayer): boolean {
  return (p.tags ?? []).some((t) => t.toLowerCase() === 'starter');
}

function sortRoomPlayers(list: TeamPlayer[]): TeamPlayer[] {
  return [...list].sort((a, b) => {
    const sa = isStarter(a) ? 0 : 1;
    const sb = isStarter(b) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });
}

function sortAlpha(list: TeamPlayer[]): TeamPlayer[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

function hometownLine(player: TeamPlayer): string {
  const raw = String(player.hometown || '').trim();
  if (!raw) return player.state?.trim() || '';
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
}: {
  id: string;
  label: string;
  players: TeamPlayer[];
}): React.ReactElement {
  return (
    <section className="gv-team-roster-room" aria-labelledby={`roster-room-${id}`}>
      <header className="gv-team-roster-room__head">
        <h3 id={`roster-room-${id}`} className="gv-team-roster-room__title">
          {label}
        </h3>
        <span className="gv-team-roster-room__count">{players.length}</span>
      </header>
      <div className="gv-team-roster-grid">
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>
    </section>
  );
}

function FullRosterPanel({ players }: { players: TeamPlayer[] }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const alpha = useMemo(() => sortAlpha(players), [players]);

  return (
    <section className="gv-team-roster-full" aria-labelledby="roster-full-title">
      <div className="gv-team-roster-full__panel">
        <p className="gv-team-roster-full__kicker">Directory</p>
        <h3 id="roster-full-title" className="gv-team-roster-full__title">
          Full roster
        </h3>
        <p className="gv-team-roster-full__copy">
          Prefer the rooms above for position-by-position. Open the full {players.length}-player
          directory only when you want everyone at once.
        </p>
        <button
          type="button"
          className="gv-team-roster-full__toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide full roster' : `Show all ${players.length} players`}
        </button>
      </div>

      {open ? (
        <div className="gv-team-roster-full__list" aria-label="Full roster A to Z">
          <div className="gv-team-roster-grid">
            {alpha.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function RosterList({ players, filter }: Props): React.ReactElement {
  const filtered = useMemo(
    () =>
      sortRoomPlayers(players.filter((p) => rosterMatchesFilter(p.position, filter, p.positionGroup))),
    [players, filter]
  );

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
        players: sortRoomPlayers(map.get(g) ?? []),
      }))
      .filter((room) => room.players.length > 0);
  }, [filtered, filter]);

  if (filtered.length === 0) {
    return <p className="gv-team-status">No players match this filter.</p>;
  }

  return (
    <div className="gv-team-roster-rooms">
      {rooms.map((room) => (
        <RoomSection key={room.id} id={room.id} label={room.label} players={room.players} />
      ))}
      {filter === 'All' ? <FullRosterPanel players={players} /> : null}
    </div>
  );
}
