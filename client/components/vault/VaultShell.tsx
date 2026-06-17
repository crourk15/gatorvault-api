'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { usePathname } from '@/lib/use-pathname';
import { VAULT_BOTTOM_NAV, VAULT_PILLARS, VAULT_SECONDARY, isVaultPath, type VaultSectionId } from '@/lib/vault-routes';
import { isVaultAdmin } from '@/lib/admin-access';
import { GatorVaultWordmark } from '@/components/brand/GatorVaultWordmark';
import { VaultNavLink } from '@/components/vault/VaultNavLink';
import { useVaultNavigation } from '@/components/vault/VaultNavigationProvider';

const ADMIN_NAV_ITEM = {
  id: 'admin' as VaultSectionId,
  label: 'War Room',
  href: '/vault/admin',
  icon: '⚙️',
};

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
    <VaultNavLink
      href={item.href}
      className={`${className}${sidebarActive(pathname, item.href) ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <span className="gv-vault-shell__nav-icon" aria-hidden="true">
        {item.icon}
      </span>
      <span className="gv-vault-shell__nav-label">{item.label}</span>
    </VaultNavLink>
  );
}

export function VaultShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const pathname = usePathname();
  const { isNavigating } = useVaultNavigation();
  const { user } = useUser();
  const [navOpen, setNavOpen] = useState(false);
  const inVault = isVaultPath(pathname);
  const isHome =
    (pathname.replace(/\/$/, '') || '/') === '/vault';

  const coreNav = VAULT_PILLARS;
  const secondaryNav = useMemo(() => {
    const items = [...VAULT_SECONDARY];
    if (isVaultAdmin(user)) items.push(ADMIN_NAV_ITEM);
    return items;
  }, [user]);

  const showAdminLink = isVaultAdmin(user);

  const toggleNav = useCallback(() => setNavOpen((v) => !v), []);
  const closeNav = useCallback(() => setNavOpen(false), []);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.dispatchEvent(new Event('vault:pageshow-restore'));
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  return (
    <div
      className={`gv-vault-shell${isNavigating ? ' is-navigating' : ''}${
        isHome ? ' gv-vault-shell--home' : ''
      }`}
    >
      <style
        dangerouslySetInnerHTML={{
          __html:
            '.gv-hub-tabs--scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}.gv-vault-bottom-nav{padding-bottom:env(safe-area-inset-bottom,0)}',
        }}
      />
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
          <VaultNavLink href={inVault ? '/vault' : '/'} className="gv-vault-shell__brand">
            <GatorVaultWordmark height={28} className="gv-vault-shell__wordmark" />
          </VaultNavLink>
        </div>
        {showAdminLink ? (
          <VaultNavLink href="/vault/admin" className="gv-vault-shell__admin-link">
            War Room
          </VaultNavLink>
        ) : null}
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
        <main className="gv-vault-shell__main">{children}</main>
      </div>
      <nav className="gv-vault-bottom-nav" aria-label="Vault quick navigation">
        {VAULT_BOTTOM_NAV.map((item) => (
          <VaultNavLink
            key={item.id}
            href={item.href}
            className={`gv-vault-bottom-nav__item${
              sidebarActive(pathname, item.href) ? ' is-active' : ''
            }`}
          >
            <span className="gv-vault-bottom-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="gv-vault-bottom-nav__label">{item.label.replace(' Hub', '').replace('Schedule & ', '')}</span>
          </VaultNavLink>
        ))}
      </nav>
    </div>
  );
}
