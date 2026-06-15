'use client';

import React from 'react';

const TILES = [
  {
    icon: '📋',
    title: 'Player Directory',
    desc: 'Search high school, portal, and college players.',
    href: '/directory',
    label: 'Open Directory',
  },
  {
    icon: '📄',
    title: 'Scouting Reports',
    desc: 'Featured evaluations with strengths, weaknesses, projection.',
    href: '/scouting/reports',
    label: 'View Reports',
  },
  {
    icon: '📥',
    title: 'Evaluation Queue',
    desc: 'Targets awaiting full War Room write-ups.',
    href: '/scouting/queue',
    label: 'View Queue',
  },
  {
    icon: '🗄️',
    title: 'Full Database',
    desc: 'Browse all scouting profiles by type.',
    href: '/scouting/database',
    label: 'Open Database',
  },
];

export function ScoutingTiles(): React.ReactElement {
  return (
    <div className="gv-rh-scout-grid" data-testid="recruiting-scouting-tiles">
      {TILES.map((tile) => (
        <div key={tile.title} className="gv-rh-scout-tile">
          <span className="gv-rh-scout-tile__icon" aria-hidden="true">
            {tile.icon}
          </span>
          <h3 className="gv-rh-scout-tile__title">{tile.title}</h3>
          <p className="gv-rh-scout-tile__desc">{tile.desc}</p>
          <a href={tile.href} className="gv-btn gv-btn--secondary gv-rh-scout-tile__btn">
            {tile.label}
          </a>
        </div>
      ))}
    </div>
  );
}

/** @deprecated use ScoutingTiles */
export const RecruitingScoutingTiles = ScoutingTiles;
