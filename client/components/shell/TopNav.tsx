'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from '@/lib/use-pathname';
import { TOP_NAV_ITEMS, siteNavActiveId } from '@/lib/site-routes';
import { GatorVaultWordmark } from '@/components/brand/GatorVaultWordmark';

export function TopNav(): React.ReactElement {
  const pathname = usePathname();
  const active = siteNavActiveId(pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const linkClass = (id: string) =>
    `gv-top-nav__link${active === id ? ' is-active' : ''}`;

  return (
    <header className="gv-top-nav">
      <div className="gv-top-nav__inner">
        <Link href="/" className="gv-top-nav__brand" aria-label="GatorVault home">
          <GatorVaultWordmark height={28} />
        </Link>

        <nav className="gv-top-nav__links" aria-label="Main">
          {TOP_NAV_ITEMS.map((item) => (
            <Link key={item.id} href={item.href} className={linkClass(item.id)}>
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="gv-top-nav__menu-btn"
          aria-expanded={drawerOpen}
          aria-controls="gv-top-nav-drawer"
          onClick={() => setDrawerOpen((v) => !v)}
        >
          {drawerOpen ? 'Close' : 'Menu'}
        </button>
      </div>

      <nav
        id="gv-top-nav-drawer"
        className={`gv-top-nav__drawer${drawerOpen ? ' is-open' : ''}`}
        aria-label="Mobile menu"
        hidden={!drawerOpen}
      >
        {TOP_NAV_ITEMS.map((item) => (
          <Link key={item.id} href={item.href} className={linkClass(item.id)}>
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
