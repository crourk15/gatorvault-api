'use client';

import React from 'react';
import { usePathname } from '@/lib/use-pathname';

const LINKS = [
  { id: 'home', href: '/', label: 'Home' },
  { id: 'vault', href: '/vault', label: 'Inside the Vault' },
  { id: 'futurecast', href: '/futurecast', label: 'FutureCast' },
] as const;

function activeId(pathname: string): string | null {
  const p = pathname.replace(/\/$/, '') || '/';
  if (p === '/') return 'home';
  if (p.startsWith('/vault')) return 'vault';
  if (
    p.startsWith('/futurecast') ||
    p.startsWith('/player') ||
    p.startsWith('/portal') ||
    p.startsWith('/alerts') ||
    p.startsWith('/staff')
  ) {
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
