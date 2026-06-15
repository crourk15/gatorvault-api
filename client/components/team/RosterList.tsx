'use client';

import React, { useMemo } from 'react';
import type { TeamPlayer } from '@/lib/team-hub-types';
import { rosterMatchesFilter, type RosterFilter } from '@/lib/team-hub-data';
import { playerProfilePath } from '@/lib/player-routes';

type Props = {
  players: TeamPlayer[];
  filter: RosterFilter;
};

export function RosterList({ players, filter }: Props): React.ReactElement {
  const filtered = useMemo(
    () => players.filter((p) => rosterMatchesFilter(p.position, filter)),
    [players, filter]
  );

  if (filtered.length === 0) {
    return <p className="gv-team-status">No players match this filter.</p>;
  }

  return (
    <div className="gv-team-roster-grid">
      {filtered.map((player) => {
        const href = player.slug
          ? playerProfilePath(player.slug, 'ROSTER', true, player.name, 'roster')
          : undefined;
        const meta = [player.position, player.classYear, player.hometown].filter(Boolean).join(' · ');

        return (
          <article key={player.id} className="gv-team-roster-card">
            {href ? (
              <a href={href} className="gv-team-roster-card__name" style={{ color: 'inherit', textDecoration: 'none' }}>
                {player.name}
              </a>
            ) : (
              <p className="gv-team-roster-card__name">{player.name}</p>
            )}
            <p className="gv-team-roster-card__meta">{meta}</p>
            {player.tags && player.tags.length > 0 && (
              <div className="gv-team-roster-card__tags">
                {player.tags.map((tag) => (
                  <span key={tag} className="gv-team-roster-tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
