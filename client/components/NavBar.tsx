'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from '@/lib/use-pathname';
import { getVaultNavHref, navActiveId } from '@/lib/navConfig';
import { useUser } from '@/hooks/useUser';
import { useHydrated } from '@/hooks/useHydrated';
import { GatorVaultWordmark } from '@/components/brand/GatorVaultWordmark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const MAIN_LINKS = [
  { id: 'home', label: 'Home', href: '/welcome' },
  { id: 'futurecast', label: 'FutureCast', vaultKey: 'futurecast' as const },
  { id: 'recruiting', label: 'Recruiting', vaultKey: 'recruiting' as const },
  { id: 'filmRoom', label: 'Film Room', vaultKey: 'filmRoom' as const },
  { id: 'insider', label: 'Insider', href: '/insider' },
] as const;

export function NavBar({ marketing = false }: { marketing?: boolean }): React.ReactElement {
  const pathname = usePathname();
  const current = navActiveId(pathname);
  const hydrated = useHydrated();
  const { user, isInsider, ready } = useUser();
  const loggedIn = hydrated && ready && !!user?.email;
  const showInsider = hydrated && ready && isInsider;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const linkClass = (id: string) =>
    `gv-site-nav__link gv-nav-premium__link${current === id ? ' is-active' : ''}`;

  const resolveHref = (link: (typeof MAIN_LINKS)[number]): string => {
    if ('href' in link && link.href) return link.href;
    if ('vaultKey' in link && link.vaultKey) return getVaultNavHref(link.vaultKey, loggedIn);
    return '/welcome';
  };

  return (
    <header className={`gv-site-header gv-nav-premium nav${marketing ? ' gv-site-header--marketing' : ''}`}>
      <div className="gv-nav-premium__inner">
        <div className="gv-nav-premium__left">
          <Link href="/welcome" className="gv-site-header__brand nav-logo">
            <GatorVaultWordmark height={30} className="gv-site-header__wordmark" />
          </Link>
        </div>

        <nav className="gv-nav-premium__center gv-site-nav" aria-label="Main">
          {MAIN_LINKS.map((link) => (
            <Link key={link.id} href={resolveHref(link)} className={linkClass(link.id)}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="gv-nav-premium__right gv-site-nav-actions">
          <ThemeToggle />
          {!hydrated || !ready ? (
            <span className="gv-site-nav__link" aria-hidden="true">
              &nbsp;
            </span>
          ) : null}
          {!loggedIn && hydrated && ready ? (
            <Link href="/join?mode=signin" className="gv-site-nav__link">
              Sign in
            </Link>
          ) : null}
          {loggedIn ? (
            <Link href="/vault" className="gv-site-nav__link">
              Profile
            </Link>
          ) : null}
          {showInsider ? <span className="nav-insider-badge">Insider</span> : null}
          {!showInsider && hydrated && ready ? (
            <Link href="/insider" className="gv-site-nav__cta gv-nav-premium__cta">
              Become an Insider
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

      <div id="nav-links-panel" className={`gv-site-nav-panel gv-nav-premium__mobile${menuOpen ? ' is-open' : ''}`}>
        <nav className="gv-site-nav nav-links-inner" aria-label="Mobile main">
          {MAIN_LINKS.map((link) => (
            <Link key={link.id} href={resolveHref(link)} className={linkClass(link.id)}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="gv-nav-premium__mobile-actions">
          <ThemeToggle />
          {!loggedIn && hydrated && ready ? (
            <Link href="/join?mode=signin" className="gv-site-nav__link">
              Sign in
            </Link>
          ) : null}
          {!showInsider && hydrated && ready ? (
            <Link href="/insider" className="gv-site-nav__cta">
              Become an Insider
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
