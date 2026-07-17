'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from '@/lib/use-pathname';
import { getVaultNavHref, navActiveId } from '@/lib/navConfig';
import { useUser } from '@/hooks/useUser';
import { GatorVaultWordmark } from '@/components/brand/GatorVaultWordmark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const MAIN_LINKS = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'futurecast', label: 'FutureCast', vaultKey: 'futurecast' as const },
  { id: 'recruiting', label: 'Recruiting', vaultKey: 'recruiting' as const },
  { id: 'filmRoom', label: 'Film Room', vaultKey: 'filmRoom' as const },
  { id: 'insider', label: 'Insider', href: '/insider' },
] as const;

function AuthLinks({
  loggedIn,
  showInsider,
  ready,
}: {
  loggedIn: boolean;
  showInsider: boolean;
  ready: boolean;
}): React.ReactElement {
  if (!ready) {
    return (
      <>
        <Link href="/join/?mode=signin" className="gv-site-nav__link">
          Sign in
        </Link>
        <Link href="/insider" className="gv-site-nav__cta gv-nav-premium__cta">
          Become an Insider
        </Link>
      </>
    );
  }

  if (loggedIn) {
    return (
      <>
        <Link href="/vault" className="gv-site-nav__link">
          Profile
        </Link>
        {showInsider ? <span className="nav-insider-badge">Insider</span> : null}
        {!showInsider ? (
          <Link href="/insider" className="gv-site-nav__cta gv-nav-premium__cta">
            Become an Insider
          </Link>
        ) : null}
        <Link href="/vault" className="gv-site-nav__cta gv-site-nav__cta--vault">
          Enter Vault
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/join/?mode=signin" className="gv-site-nav__link">
        Sign in
      </Link>
      <Link href="/insider" className="gv-site-nav__cta gv-nav-premium__cta">
        Become an Insider
      </Link>
    </>
  );
}

export function NavBar({ marketing = false }: { marketing?: boolean }): React.ReactElement {
  const pathname = usePathname();
  const current = navActiveId(pathname);
  const { user, isInsider, ready } = useUser();
  const loggedIn = ready && !!(user?.email && user?.token);
  const showInsider = ready && isInsider;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('gv-nav-menu-open', menuOpen);
    return () => document.body.classList.remove('gv-nav-menu-open');
  }, [menuOpen]);

  const linkClass = (id: string) =>
    `gv-site-nav__link gv-nav-premium__link${current === id ? ' is-active' : ''}`;

  const resolveHref = (link: (typeof MAIN_LINKS)[number]): string => {
    if ('href' in link && link.href) return link.href;
    if ('vaultKey' in link && link.vaultKey) return getVaultNavHref(link.vaultKey, loggedIn);
    return '/';
  };

  return (
    <header className={`gv-site-header gv-nav-premium nav${marketing ? ' gv-site-header--marketing' : ''}`}>
      <div className="gv-nav-premium__inner">
        <div className="gv-nav-premium__left">
          <Link href="/" className="gv-site-header__brand nav-logo">
            <GatorVaultWordmark height={30} className="gv-site-header__wordmark" />
          </Link>
        </div>

        <nav
          className="gv-nav-premium__center gv-site-nav gv-nav-premium__desktop-only"
          aria-label="Main"
        >
          {MAIN_LINKS.map((link) => (
            <Link key={link.id} href={resolveHref(link)} className={linkClass(link.id)}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="gv-nav-premium__right gv-nav-premium__desktop-only" suppressHydrationWarning>
          <ThemeToggle />
          <AuthLinks loggedIn={loggedIn} showInsider={showInsider} ready={ready} />
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

      <div
        id="nav-links-panel"
        className={`gv-site-nav-panel gv-nav-premium__mobile${menuOpen ? ' is-open' : ''}`}
        hidden={!menuOpen}
      >
        <nav className="gv-site-nav nav-links-inner" aria-label="Mobile main">
          {MAIN_LINKS.map((link) => (
            <Link key={link.id} href={resolveHref(link)} className={linkClass(link.id)}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="gv-nav-premium__mobile-actions" suppressHydrationWarning>
          <ThemeToggle />
          <AuthLinks loggedIn={loggedIn} showInsider={showInsider} ready={ready} />
        </div>
      </div>
    </header>
  );
}
