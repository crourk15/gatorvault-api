'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from '@/lib/use-pathname';
import { MOBILE_BOTTOM_NAV, siteNavActiveId, type SiteSectionId } from '@/lib/site-routes';

const ICONS: Record<SiteSectionId, string> = {
  dashboard: '🏠',
  recruiting: '🎯',
  futurecast: '📈',
  team: '👥',
  gatorNationLive: '⚡',
  schedule: '🎟️',
  filmRoom: '📺',
  gameWeek: '🏈',
  liveScores: '📊',
  articles: '📰',
  community: '💬',
  gameZone: '🏆',
  nil: '💰',
};

export function MobileBottomNav(): React.ReactElement {
  const pathname = usePathname();
  const active = siteNavActiveId(pathname);

  return (
    <nav className="gv-mobile-bottom-nav" aria-label="Quick navigation">
      {MOBILE_BOTTOM_NAV.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`gv-mobile-bottom-nav__item${active === item.id ? ' is-active' : ''}`}
        >
          <span className="gv-mobile-bottom-nav__icon" aria-hidden="true">
            {ICONS[item.id]}
          </span>
          <span>{item.label.replace('Game Week', 'Game').replace('Live Scores', 'Scores')}</span>
        </Link>
      ))}
    </nav>
  );
}
