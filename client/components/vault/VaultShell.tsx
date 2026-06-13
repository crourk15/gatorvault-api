'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePathname } from '@/lib/use-pathname';
import { VAULT_SIDEBAR, isVaultPath } from '@/lib/vault-routes';

function sidebarActive(pathname: string, href: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/';
  const h = href.replace(/\/$/, '') || '/';
  if (h === '/vault') return p === '/vault';
  return p === h || p.startsWith(`${h}/`);
}

export function VaultShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const inVault = isVaultPath(pathname);

  const toggleNav = useCallback(() => setNavOpen((v) => !v), []);
  const closeNav = useCallback(() => setNavOpen(false), []);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

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
            <span>🐊</span>
            <span>GatorVault</span>
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
          <p className="gv-vault-shell__sidebar-label">The Vault</p>
          <ul className="gv-vault-shell__nav">
            {VAULT_SIDEBAR.map((item) => (
              <li key={item.id}>
                <a
                  href={item.href}
                  className={`gv-vault-shell__nav-link${
                    sidebarActive(pathname, item.href) ? ' is-active' : ''
                  }`}
                  onClick={closeNav}
                >
                  <span className="gv-vault-shell__nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>
        <main className="gv-vault-shell__main">{children}</main>
      </div>
    </div>
  );
}
