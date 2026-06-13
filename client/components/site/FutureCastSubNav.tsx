'use client';

import React from 'react';
import { usePathname } from '@/lib/use-pathname';
import { futureCastSubHref, type FutureCastSubId } from '@/lib/vault-routes';

const SUB_LINKS: { id: FutureCastSubId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'stock', label: 'Stock Up / Down' },
  { id: 'snapshots', label: 'Snapshots' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'staff', label: 'Movement Intel' },
];

export type { FutureCastSubId };

export function FutureCastSubNav({ active }: { active: FutureCastSubId }): React.ReactElement {
  const pathname = usePathname();

  return (
    <nav className="fc-futurecast-nav" aria-label="FutureCast">
      {SUB_LINKS.map((link) => (
        <a
          key={link.id}
          href={futureCastSubHref(pathname, link.id)}
          className={`fc-futurecast-nav__link${active === link.id ? ' is-active' : ''}`}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
