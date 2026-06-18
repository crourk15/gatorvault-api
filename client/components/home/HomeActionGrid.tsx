'use client';

import React from 'react';
import { SITE_ROUTES } from '@/lib/site-routes';

const ICONS: Record<string, string> = {
  rh: '🎯',
  fc: '📈',
  team: '👥',
  gameweek: '🏈',
  film: '📺',
  nil: '💰',
  community: '💬',
  tickets: '🎟️',
};

const TILES = [
  { id: 'rh', label: 'Recruiting Hub', href: SITE_ROUTES.recruiting },
  { id: 'fc', label: 'FutureCast Lab', href: SITE_ROUTES.futurecast },
  { id: 'team', label: 'Team', href: SITE_ROUTES.team },
  { id: 'gameweek', label: 'Game Week', href: SITE_ROUTES.gameWeek },
  { id: 'film', label: 'Film Room', href: SITE_ROUTES.filmRoom },
  { id: 'nil', label: 'NIL Tracker', href: SITE_ROUTES.nil },
  { id: 'community', label: 'Community', href: SITE_ROUTES.community },
  { id: 'tickets', label: 'Tickets', href: '/vault/tickets' },
] as const;

export function HomeActionGrid(): React.ReactElement {
  return (
    <div className="gv-action-grid" data-testid="home-action-grid">
      {TILES.map((t) => (
        <a key={t.id} href={t.href} className="gv-action-tile">
          <div className="gv-action-tile__icon" aria-hidden>
            {ICONS[t.id]}
          </div>
          <div className="gv-action-tile__label">{t.label}</div>
        </a>
      ))}
    </div>
  );
}
