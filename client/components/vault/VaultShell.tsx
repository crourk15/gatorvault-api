'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePathname } from '@/lib/use-pathname';
import { VAULT_BOTTOM_NAV, VAULT_PILLARS, VAULT_SECONDARY, isVaultPath, type VaultSectionId } from '@/lib/vault-routes';
import { prefetchVaultHref } from '@/lib/vault-navigation';
import { GatorVaultWordmark } from '@/components/brand/GatorVaultWordmark';
import { useHydrated } from '@/hooks/useHydrated';

function sidebarActive(pathname: string, href: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/';
  const h = href.replace(/\/$/, '') || '/';
  if (h === '/vault') return p === '/vault';
  if (h === '/vault/recruiting') {
    return (
      p === h ||
      p.startsWith(`${h}/`) ||
      p.startsWith('/vault/recruiting/player/')
    );
  }
  if (h === '/vault/team') {
    return p === h || p.startsWith('/vault/players/');
  }
  if (h === '/vault/live' || h === '/vault/live-feed') {
    return p === '/vault/live' || p.startsWith('/vault/live/') || p === '/vault/live-feed' || p.startsWith('/vault/live-feed/');
  }
  if (h === '/vault/schedule') {
    return p === h || p.startsWith(`${h}/`) || p === '/vault/tickets' || p.startsWith('/vault/tickets/');
  }
  if (h === '/vault/futurecast') {
    return p === h || p.startsWith(`${h}/`);
  }
  if (h === '/vault/admin') {
    return p === '/vault/admin' || p.startsWith('/vault/admin/');
  }
  return p === h || p.startsWith(`${h}/`);
}

function NavLink({
  item,
  pathname,
  onClick,
  className,
}: {
  item: { id: string; label: string; href: string; icon: string };
  pathname: string;
  onClick?: () => void;
  className: string;
}): React.ReactElement {
  return (
    <a
      href={item.href}
      className={`${className}${sidebarActive(pathname, item.href) ? ' is-active' : ''}`}
      onClick={onClick}
      onMouseEnter={() => prefetchVaultHref(item.href)}
      onFocus={() => prefetchVaultHref(item.href)}
    >
      <span className="gv-vault-shell__nav-icon" aria-hidden="true">
        {item.icon}
      </span>
      <span className="gv-vault-shell__nav-label">{item.label}</span>
    </a>
  );
}

export function VaultShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const inVault = isVaultPath(pathname);
  const hydrated = useHydrated();

  const coreNav = VAULT_PILLARS;
  const secondaryNav = VAULT_SECONDARY.filter((item) => item.id !== 'admin');

  const toggleNav = useCallback(() => setNavOpen((v) => !v), []);
  const closeNav = useCallback(() => setNavOpen(false), []);

  useEffect(() => {
    setNavOpen(false);
    prefetchVaultHref(pathname);
  }, [pathname]);

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.dispatchEvent(new Event('vault:pageshow-restore'));
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  return (
    <div className="gv-vault-shell">
      <header className="gv-vault-shell__header">
        <div className="gv-vault-shell__header-start">
          <button
            type="button"
            className="gv-vault-shell__menu-btn gv-vault-shell__menu-btn--mobile"
            aria-expanded={navOpen}
            aria-controls="gv-vault-shell-sidebar"
            onClick={toggleNav}
          >
            ☰
          </button>
          <a href={inVault ? '/vault' : '/'} className="gv-vault-shell__brand">
            <GatorVaultWordmark height={28} className="gv-vault-shell__wordmark" />
          </a>
        </div>
      </header>
      {navOpen && (
        <button
          type="button"
          className="gv-vault-shell__backdrop"
          aria-label="Close navigation"
          onClick={closeNav}
        />
      )}
      <div className="gv-vault-shell__body">
        <aside
          id="gv-vault-shell-sidebar"
          className={`gv-vault-shell__sidebar${navOpen ? ' is-open' : ''}`}
          aria-label="Vault navigation"
        >
          <p className="gv-vault-shell__sidebar-label">Core</p>
          <ul className="gv-vault-shell__nav">
            {coreNav.map((item) => (
              <li key={item.id}>
                <NavLink
                  item={item}
                  pathname={pathname}
                  onClick={closeNav}
                  className="gv-vault-shell__nav-link"
                />
              </li>
            ))}
          </ul>
          <p className="gv-vault-shell__sidebar-label gv-vault-shell__sidebar-label--secondary">More</p>
          <ul className="gv-vault-shell__nav">
            {secondaryNav.map((item) => (
              <li key={item.id}>
                <NavLink
                  item={item}
                  pathname={pathname}
                  onClick={closeNav}
                  className="gv-vault-shell__nav-link"
                />
              </li>
            ))}
          </ul>
        </aside>
        <main className="gv-vault-shell__main">
          {!hydrated ? (
            <div className="gv-vault-shell__skeleton" aria-busy="true" aria-label="Loading vault">
              <div className="gv-vault-shell__skeleton-bar" />
              <div className="gv-vault-shell__skeleton-bar gv-vault-shell__skeleton-bar--short" />
              <div className="gv-vault-shell__skeleton-grid">
                <div className="gv-vault-shell__skeleton-card" />
                <div className="gv-vault-shell__skeleton-card" />
                <div className="gv-vault-shell__skeleton-card" />
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
      <nav className="gv-vault-bottom-nav" aria-label="Vault quick navigation">
        {VAULT_BOTTOM_NAV.map((item) => (
          <a
            key={item.id}
            href={item.href}
            className={`gv-vault-bottom-nav__item${
              sidebarActive(pathname, item.href) ? ' is-active' : ''
            }`}
            onMouseEnter={() => prefetchVaultHref(item.href)}
            onFocus={() => prefetchVaultHref(item.href)}
          >
            <span className="gv-vault-bottom-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="gv-vault-bottom-nav__label">{item.label.replace(' Hub', '').replace('Schedule & ', '')}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
