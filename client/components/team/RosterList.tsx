'use client';

import React, { useMemo } from 'react';
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

function sortPlayers(list: TeamPlayer[]): TeamPlayer[] {
  return [...list].sort((a, b) => {
    const sa = isStarter(a) ? 0 : 1;
    const sb = isStarter(b) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });
}

function PlayerCard({ player }: { player: TeamPlayer }): React.ReactElement {
  const href = player.slug
    ? playerProfilePath(player.slug, 'ROSTER', true, player.name, 'roster')
    : undefined;
  const hometown = [player.hometown, player.state].filter(Boolean).join(', ');
  const starter = isStarter(player);

  const body = (
    <>
      <div className="gv-team-roster-card__top">
        <span className="gv-team-roster-card__pos">{player.position || '—'}</span>
        {starter ? <span className="gv-team-roster-card__starter">Starter</span> : null}
      </div>
      <p className="gv-team-roster-card__name">{player.name}</p>
      <p className="gv-team-roster-card__meta">
        {[player.classYear, hometown].filter(Boolean).join(' · ')}
      </p>
      {player.tags && player.tags.filter((t) => t.toLowerCase() !== 'starter').length > 0 ? (
        <div className="gv-team-roster-card__tags">
          {player.tags
            .filter((t) => t.toLowerCase() !== 'starter')
            .map((tag) => (
              <span key={tag} className="gv-team-roster-tag">
                {tag}
              </span>
            ))}
        </div>
      ) : null}
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

export function RosterList({ players, filter }: Props): React.ReactElement {
  const filtered = useMemo(
    () =>
      sortPlayers(players.filter((p) => rosterMatchesFilter(p.position, filter, p.positionGroup))),
    [players, filter]
  );

  const rooms = useMemo(() => {
    if (filter !== 'All') return null;
    const map = new Map<RosterPositionGroup | 'OTHER', TeamPlayer[]>();
    for (const p of filtered) {
      const g = resolveRosterPositionGroup(p.position, p.positionGroup) ?? 'OTHER';
      const list = map.get(g) ?? [];
      list.push(p);
      map.set(g, list);
    }
    return GROUP_ORDER.map((g) => ({
      id: g,
      label: GROUP_LABEL[g],
      players: sortPlayers(map.get(g) ?? []),
    })).filter((room) => room.players.length > 0);
  }, [filtered, filter]);

  if (filtered.length === 0) {
    return <p className="gv-team-status">No players match this filter.</p>;
  }

  if (rooms) {
    return (
      <div className="gv-team-roster-rooms">
        {rooms.map((room) => (
          <section key={room.id} className="gv-team-roster-room" aria-labelledby={`roster-room-${room.id}`}>
            <header className="gv-team-roster-room__head">
              <h3 id={`roster-room-${room.id}`} className="gv-team-roster-room__title">
                {room.label}
              </h3>
              <span className="gv-team-roster-room__count">{room.players.length}</span>
            </header>
            <div className="gv-team-roster-grid">
              {room.players.map((player) => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="gv-team-roster-grid">
      {filtered.map((player) => (
        <PlayerCard key={player.id} player={player} />
      ))}
    </div>
  );
}
