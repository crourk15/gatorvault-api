'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from '@/lib/use-pathname';
import {
  FUTURECAST_SEGMENT_PATHS,
  parseFutureCastSegmentFromPath,
  type FutureCastSegment,
} from '@/lib/vault-route-map';
import { isDiscoverySeasonFocus } from '@/components/futurecast/lab/fc-lab-types';

const PORTAL_SUB_LINKS: { id: FutureCastSegment; label: string }[] = [
  { id: 'master', label: 'Master Board' },
  { id: 'trending', label: 'Trending Board' },
  { id: 'movement', label: 'Movement Intel' },
  { id: 'staff', label: 'Staff Notes' },
];

const DISCOVERY_SUB_LINKS: { id: FutureCastSegment; label: string }[] = [
  { id: 'master', label: '2028 Targets' },
  { id: 'trending', label: 'Battles' },
  { id: 'movement', label: 'Movement' },
];

const BIG_BOARD_HREF = '/vault/futurecast/big-board';
const ALERTS_HREF = '/vault/futurecast/alerts';

export type FutureCastSubId = FutureCastSegment;

export function FutureCastSubNav({
  active,
}: {
  active?: FutureCastSegment;
}): React.ReactElement {
  const pathname = usePathname();
  const [hash, setHash] = useState('');
  const discoverySeason = useMemo(() => isDiscoverySeasonFocus(), []);

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash.slice(1));
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [pathname]);

  const current = active ?? parseFutureCastSegmentFromPath(pathname, hash);
  const subLinks = discoverySeason ? DISCOVERY_SUB_LINKS : PORTAL_SUB_LINKS;

  return (
    <nav className="fc-futurecast-nav" aria-label="FutureCast">
      {subLinks.map((link) => (
        <a
          key={link.id}
          href={FUTURECAST_SEGMENT_PATHS[link.id]}
          className={`fc-futurecast-nav__link${current === link.id ? ' is-active' : ''}`}
        >
          {link.label}
        </a>
      ))}
      <a
        href={BIG_BOARD_HREF}
        className={`fc-futurecast-nav__link${pathname?.includes('/futurecast/big-board') ? ' is-active' : ''}`}
        data-testid="fc-big-board-nav"
      >
        {discoverySeason ? 'Early Discovery' : 'Big Board'}
      </a>
      <a
        href={ALERTS_HREF}
        className={`fc-futurecast-nav__link${pathname?.includes('/futurecast/alerts') ? ' is-active' : ''}`}
        data-testid="fc-alerts-nav"
      >
        Alerts
      </a>
    </nav>
  );
}
