'use client';

import React from 'react';
import { usePathname } from '@/lib/use-pathname';
import { VAULT_SIDEBAR } from '@/lib/vault-routes';

function sidebarActive(pathname: string, href: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/';
  const h = href.replace(/\/$/, '') || '/';
  if (h === '/vault') return p === '/vault';
  return p === h || p.startsWith(`${h}/`);
}

export function VaultShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const pathname = usePathname();

  return (
    <div className="gv-vault-shell">
      <header className="gv-vault-shell__header">
        <a href="/" className="gv-vault-shell__brand">
          <span>🐊</span>
          <span>GatorVault</span>
        </a>
        <nav className="gv-vault-shell__topnav" aria-label="Site">
          <a href="/">Home</a>
          <a href="/vault" className="is-active">Inside the Vault</a>
          <a href="/futurecast">FutureCast</a>
        </nav>
      </header>
      <div className="gv-vault-shell__body">
        <aside className="gv-vault-shell__sidebar" aria-label="Vault navigation">
          <p className="gv-vault-shell__sidebar-label">The Vault</p>
          <ul className="gv-vault-shell__nav">
            {VAULT_SIDEBAR.map((item) => (
              <li key={item.id}>
                <a
                  href={item.href}
                  className={`gv-vault-shell__nav-link${
                    sidebarActive(pathname, item.href) ? ' is-active' : ''
                  }`}
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
