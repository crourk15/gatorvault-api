'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from '@/lib/use-pathname';
import {
  MOBILE_BOTTOM_NAV,
  MOBILE_MENU_ITEM,
  siteNavActiveId,
  type SiteSectionId,
} from '@/lib/site-routes';
import { PremiumNavIcon, type PremiumNavIconId } from '@/components/shell/PremiumNavIcons';
import { useAppMenu } from '@/components/shell/AppMenuContext';
import { useMobileViewport } from '@/lib/use-mobile-viewport';

const ICONS: Record<SiteSectionId, PremiumNavIconId> = {
  dashboard: 'home',
  recruiting: 'recruiting',
  futurecast: 'recruiting',
  team: 'team',
  gatorNationLive: 'live',
  schedule: 'home',
  filmRoom: 'home',
  gameWeek: 'home',
  liveScores: 'live',
  articles: 'home',
  community: 'home',
  gameZone: 'home',
  nil: 'home',
};

function navLabel(label: string): string {
  return label.replace('GatorNation Live', 'GNL Live');
}

export function MobileBottomNav(): React.ReactElement | null {
  const pathname = usePathname();
  const active = siteNavActiveId(pathname);
  const { isOpen: menuOpen, toggleMenu } = useAppMenu();
  const isMobile = useMobileViewport();

  if (!isMobile) return null;

  return (
    <nav className="gv-mobile-bottom-nav" aria-label="Quick navigation">
      {MOBILE_BOTTOM_NAV.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`gv-mobile-bottom-nav__item${active === item.id ? ' is-active' : ''}`}
        >
          <span className="gv-mobile-bottom-nav__icon" aria-hidden="true">
            <PremiumNavIcon id={ICONS[item.id]} />
          </span>
          <span className="gv-mobile-bottom-nav__label">{navLabel(item.label)}</span>
        </Link>
      ))}
      <button
        type="button"
        className={`gv-mobile-bottom-nav__item${menuOpen ? ' is-menu-open' : ''}`}
        aria-expanded={menuOpen}
        aria-controls="gv-app-menu-drawer"
        onClick={toggleMenu}
      >
        <span className="gv-mobile-bottom-nav__icon" aria-hidden="true">
          <PremiumNavIcon id="menu" />
        </span>
        <span className="gv-mobile-bottom-nav__label">{MOBILE_MENU_ITEM.label}</span>
      </button>
    </nav>
  );
}
