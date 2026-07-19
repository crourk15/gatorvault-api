'use client';

import React from 'react';
import { SITE_ROUTES } from '@/lib/site-routes';

const TILES = [
  { href: SITE_ROUTES.recruiting, icon: '🎯', label: 'Recruiting Hub' },
  { href: SITE_ROUTES.futurecast, icon: '📈', label: 'FutureCast Lab' },
  { href: SITE_ROUTES.team, icon: '👥', label: 'Team' },
  { href: SITE_ROUTES.gameWeek, icon: '🏈', label: 'Game Week' },
  { href: SITE_ROUTES.filmRoom, icon: '📺', label: 'Film Room' },
  { href: SITE_ROUTES.nil, icon: '💰', label: 'NIL Tracker' },
  { href: SITE_ROUTES.community, icon: '💬', label: 'Community' },
  { href: '/vault/schedule', icon: '🎟️', label: 'Schedule' },
] as const;

export function HomeActionGrid(): React.ReactElement {
  return (
    <section className="gv-hcc-section" aria-label="Quick navigation" data-testid="home-action-grid">
      <div className="gv-hcc-action-grid">
        {TILES.map((tile) => (
          <a key={tile.href} href={tile.href} className="gv-hcc-action-tile">
            <span className="gv-hcc-action-tile__icon" aria-hidden>
              {tile.icon}
            </span>
            <span className="gv-hcc-action-tile__label">{tile.label}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
