'use client';

import React from 'react';
import { usePathname } from '@/lib/use-pathname';
import {
  FUTURECAST_SEGMENT_PATHS,
  parseFutureCastSegmentFromPath,
  type FutureCastSegment,
} from '@/lib/vault-route-map';

const SUB_LINKS: { id: FutureCastSegment; label: string }[] = [
  { id: 'master', label: 'Master Board' },
  { id: 'trending', label: 'Trending Board' },
  { id: 'movement', label: 'Movement Intel' },
  { id: 'staff', label: 'Staff Notes' },
];

export type FutureCastSubId = FutureCastSegment;

export function FutureCastSubNav({
  active,
}: {
  active?: FutureCastSegment;
}): React.ReactElement {
  const pathname = usePathname();
  const current = active ?? parseFutureCastSegmentFromPath(pathname);

  return (
    <nav className="fc-futurecast-nav" aria-label="FutureCast">
      {SUB_LINKS.map((link) => (
        <a
          key={link.id}
          href={FUTURECAST_SEGMENT_PATHS[link.id]}
          className={`fc-futurecast-nav__link${current === link.id ? ' is-active' : ''}`}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
