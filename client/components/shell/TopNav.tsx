'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from '@/lib/use-pathname';
import { TOP_NAV_ITEMS, siteNavActiveId } from '@/lib/site-routes';
import { GatorVaultWordmark } from '@/components/brand/GatorVaultWordmark';

/** Desktop top navigation — hidden on mobile (≤767px); mobile uses page headers + bottom nav. */
export function TopNav(): React.ReactElement {
  const pathname = usePathname();
  const active = siteNavActiveId(pathname);

  const linkClass = (id: string) =>
    `gv-top-nav__link${active === id ? ' is-active' : ''}`;

  return (
    <header className="gv-top-nav gv-top-nav--desktop">
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
      </div>
    </header>
  );
}
