'use client';

import React from 'react';

export type FutureCastSubNavId = 'home' | 'stock' | 'snapshots' | 'alerts' | 'staff';

const SUB_LINKS: { id: FutureCastSubNavId; href: string; label: string }[] = [
  { id: 'home', href: '/futurecast', label: 'Home' },
  { id: 'stock', href: '/futurecast/stock', label: 'Stock Up / Down' },
  { id: 'snapshots', href: '/futurecast/snapshots', label: 'Snapshots' },
  { id: 'alerts', href: '/alerts', label: 'Alerts' },
  { id: 'staff', href: '/staff/dashboard', label: 'Staff' },
];

export function FutureCastSubNav({ active }: { active: FutureCastSubNavId }): React.ReactElement {
  return (
    <nav className="fc-futurecast-nav" aria-label="FutureCast">
      {SUB_LINKS.map((link) => (
        <a
          key={link.id}
          href={link.href}
          className={`fc-futurecast-nav__link${active === link.id ? ' is-active' : ''}`}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
