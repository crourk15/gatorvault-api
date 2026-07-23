'use client';

import React, { useMemo } from 'react';
import type { TeamPlayer } from '@/lib/team-hub-types';
import {
  rosterMatchesFilter,
  type RosterFilter,
  type RosterPositionGroup,
} from '@/lib/roster-position-groups';
import { playerProfilePath } from '@/lib/player-routes';
import { PlayerNavLink } from '@/components/vault/PlayerNavLink';

type Props = {
  players: TeamPlayer[];
  filter: RosterFilter;
};

const GROUP_LABEL: Record<RosterPositionGroup, string> = {
  QB: 'Quarterbacks',
  RB: 'Running backs',
  WR: 'Wide receivers',
  TE: 'Tight ends',
  OL: 'Offensive line',
  DL: 'Defensive line',
  EDGE: 'Edge',
  LB: 'Linebackers',
  CB: 'Cornerbacks',
  S: 'Safeties',
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

export function RosterList({ players, filter }: Props): React.ReactElement {
  const filtered = useMemo(
    () => players.filter((p) => rosterMatchesFilter(p.position, filter, p.positionGroup)),
    [players, filter]
  );

  if (filter === 'All') {
    const alpha = sortAlpha(filtered);
    if (alpha.length === 0) {
      return <p className="gv-team-status">No players on the roster.</p>;
    }
    return (
      <section className="gv-team-roster-room" aria-labelledby="roster-room-all">
        <header className="gv-team-roster-room__head">
          <h3 id="roster-room-all" className="gv-team-roster-room__title">
            Full roster
          </h3>
          <span className="gv-team-roster-room__count">{alpha.length}</span>
        </header>
        <p className="gv-team-roster-all-note">Every player on the Florida roster, A–Z.</p>
        <div className="gv-team-roster-grid">
          {alpha.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
      </section>
    );
  }

  const roomPlayers = sortRoomPlayers(filtered);
  const group = filter as RosterPositionGroup;
  const label = GROUP_LABEL[group] ?? filter;

  if (roomPlayers.length === 0) {
    return <p className="gv-team-status">No players in this room.</p>;
  }

  return (
    <section className="gv-team-roster-room" aria-labelledby={`roster-room-${group}`}>
      <header className="gv-team-roster-room__head">
        <h3 id={`roster-room-${group}`} className="gv-team-roster-room__title">
          {label}
        </h3>
        <span className="gv-team-roster-room__count">{roomPlayers.length}</span>
      </header>
      <div className="gv-team-roster-grid">
        {roomPlayers.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>
    </section>
  );
}
