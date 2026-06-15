'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from '@/lib/use-pathname';
import { getVaultNavHref, navActiveId } from '@/lib/navConfig';
import { useUser } from '@/hooks/useUser';
import { useHydrated } from '@/hooks/useHydrated';
import { GatorVaultWordmark } from '@/components/brand/GatorVaultWordmark';

export function NavBar({ marketing = false }: { marketing?: boolean }): React.ReactElement {
  const pathname = usePathname();
  const current = navActiveId(pathname);
  const hydrated = useHydrated();
  const { user, isInsider, ready } = useUser();
  const loggedIn = hydrated && ready && !!user?.email;
  const showInsider = hydrated && ready && isInsider;
  const showUpgrade = hydrated && ready && !!user?.email && !isInsider;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const linkClass = (id: string) =>
    `gv-site-nav__link nav-link${current === id ? ' is-active' : ''}`;

  return (
    <header className={`gv-site-header nav${marketing ? ' gv-site-header--marketing' : ''}`}>
      <div className="gv-site-header__inner nav-inner">
        <div className="nav-left">
          <Link href="/welcome" className="gv-site-header__brand nav-logo">
            <GatorVaultWordmark height={30} className="gv-site-header__wordmark" />
          </Link>
        </div>

        <div className="gv-site-header__tools nav-tools">
          <div className="nav-right gv-site-nav-actions gv-site-nav-actions--inline">
            {!hydrated || !ready ? (
              <span className="gv-site-nav__link" aria-hidden="true">
                &nbsp;
              </span>
            ) : null}
            {!loggedIn && hydrated && ready ? (
              <Link href="/join" className="gv-site-nav__cta nav-cta">
                Start Free
              </Link>
            ) : null}
            {showUpgrade ? (
              <Link href="/insider" className="gv-site-nav__cta nav-cta">
                Upgrade
              </Link>
            ) : null}
            {showInsider ? <span className="nav-insider-badge">Insider</span> : null}
            {!loggedIn && hydrated && ready ? (
              <Link href="/join?mode=signin" className="gv-site-nav__link">
                Sign in
              </Link>
            ) : null}
            {loggedIn ? (
              <Link href="/vault" className="gv-site-nav__cta gv-site-nav__cta--vault">
                Enter Vault
              </Link>
            ) : null}
          </div>

          <button
            type="button"
            className="gv-site-nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="nav-links-panel"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="gv-site-nav-toggle__label">{menuOpen ? 'Close' : 'Menu'}</span>
          </button>
        </div>

        <div id="nav-links-panel" className={`gv-site-nav-panel nav-links${menuOpen ? ' is-open' : ''}`}>
          <nav className="gv-site-nav nav-links-inner" aria-label="Main">
            <Link href="/welcome" className={linkClass('home')}>
              Home
            </Link>
            <Link href={getVaultNavHref('futurecast', loggedIn)} className={linkClass('futurecast')}>
              FutureCast
            </Link>
            <Link href={getVaultNavHref('recruiting', loggedIn)} className={linkClass('recruiting')}>
              Recruiting
            </Link>
            <Link href={getVaultNavHref('filmRoom', loggedIn)} className={linkClass('filmRoom')}>
              Film Room
            </Link>
            <Link href="/insider" className={linkClass('insider')}>
              Insider
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
