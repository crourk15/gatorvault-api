'use client';

import React from 'react';
import { usePathname } from '@/lib/use-pathname';

export type SiteNavId =
  | 'home'
  | 'futurecast'
  | 'recruiting-board'
  | 'players'
  | 'scouting';

const LINKS: { id: SiteNavId; href: string; label: string }[] = [
  { id: 'home', href: '/', label: 'Vault' },
  { id: 'futurecast', href: '/futurecast', label: 'FutureCast' },
  { id: 'recruiting-board', href: '/recruiting-board', label: 'Recruiting Board' },
  { id: 'players', href: '/players', label: 'Players' },
  { id: 'scouting', href: '/scouting', label: 'Scouting' },
];

function activeId(pathname: string): SiteNavId | null {
  const p = pathname.replace(/\/$/, '') || '/';
  if (p === '/' || p.startsWith('/?')) return 'home';
  if (p.startsWith('/recruiting-board') || p.startsWith('/recruiting')) return 'recruiting-board';
  if (p.startsWith('/players')) return 'players';
  if (p.startsWith('/scouting')) return 'scouting';
  if (p.startsWith('/futurecast') || p.startsWith('/player') || p.startsWith('/alerts')) {
    return 'futurecast';
  }
  return null;
}

export function GatorVaultSiteNav(): React.ReactElement {
  const pathname = usePathname();
  const current = activeId(pathname);

  return (
    <header className="gv-site-header">
      <div className="gv-site-header__inner">
        <a href="/" className="gv-site-header__brand">
          <span className="gv-site-header__brand-mark">🐊</span>
          <span className="gv-site-header__brand-text">GatorVault</span>
        </a>
        <nav className="gv-site-nav" aria-label="Main">
          {LINKS.map((link) => (
            <a
              key={link.id}
              href={link.href}
              className={`gv-site-nav__link${current === link.id ? ' is-active' : ''}`}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
