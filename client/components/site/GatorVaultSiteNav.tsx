'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from '@/lib/use-pathname';
import { loadSession } from '@/lib/auth-api';

const LINKS = [
  { id: 'home', href: '/', label: 'Home' },
  { id: 'vault', href: '/vault', label: 'Inside the Vault' },
  { id: 'futurecast', href: '/futurecast', label: 'FutureCast' },
] as const;

function activeId(pathname: string): string | null {
  const p = pathname.replace(/\/$/, '') || '/';
  if (p === '/') return 'home';
  if (p === '/join') return 'join';
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

export function GatorVaultSiteNav({ marketing = false }: { marketing?: boolean }): React.ReactElement {
  const pathname = usePathname();
  const current = activeId(pathname);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(!!loadSession()?.email);
  }, [pathname]);

  return (
    <header className={`gv-site-header${marketing ? ' gv-site-header--marketing' : ''}`}>
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
          {signedIn ? (
            <a href="/vault" className="gv-site-nav__cta gv-site-nav__cta--vault">
              Enter Vault
            </a>
          ) : (
            <>
              <a href="/join" className="gv-site-nav__link gv-site-nav__link--join">
                Join
              </a>
              <a href="/join?mode=signin" className="gv-site-nav__cta">
                Sign in
              </a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
