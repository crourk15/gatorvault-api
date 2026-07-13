'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from '@/lib/use-pathname';
import {
  FUTURECAST_LAB_ANCHORS,
  FUTURECAST_SEGMENT_PATHS,
  futureCastLabHref,
  parseFutureCastSegmentFromPath,
  type FutureCastSegment,
} from '@/lib/vault-route-map';
import { isDiscoverySeasonFocus } from '@/components/futurecast/lab/fc-lab-types';

const BIG_BOARD_HREF = '/vault/futurecast/big-board';
const ALERTS_HREF = '/vault/futurecast/alerts';

/**
 * Closing-class Lab: prefer Lab hash anchors over parallel /trending /movement /staff pages.
 * Standalone pages remain reachable; they are just not primary nav.
 */
const CLOSING_CLASS_SUB_LINKS: { id: string; label: string; href: string }[] = [
  { id: 'master', label: 'Targets', href: FUTURECAST_SEGMENT_PATHS.master },
  { id: 'trending', label: 'Battles', href: FUTURECAST_SEGMENT_PATHS.trending },
  { id: 'movement', label: 'Movement', href: FUTURECAST_SEGMENT_PATHS.movement },
  { id: 'fit', label: 'Fit', href: futureCastLabHref(FUTURECAST_LAB_ANCHORS.positions) },
  { id: 'portal', label: 'Portal', href: futureCastLabHref(FUTURECAST_LAB_ANCHORS.portal) },
  { id: 'big-board', label: 'Big Board', href: BIG_BOARD_HREF },
  { id: 'alerts', label: 'Alerts', href: ALERTS_HREF },
];

/** Discovery season: only doors that open real Lab content. */
const DISCOVERY_SUB_LINKS: { id: string; label: string; href: string }[] = [
  { id: 'master', label: 'Targets', href: FUTURECAST_SEGMENT_PATHS.master },
  { id: 'trending', label: 'Battles', href: FUTURECAST_SEGMENT_PATHS.trending },
  { id: 'fit', label: 'Fit', href: futureCastLabHref(FUTURECAST_LAB_ANCHORS.positions) },
  { id: 'discovery', label: 'Early Discovery', href: BIG_BOARD_HREF },
];

export type FutureCastSubId = FutureCastSegment;

function linkIsActive(
  link: { id: string; href: string },
  pathname: string | null,
  current: FutureCastSegment,
  hash: string
): boolean {
  if (link.id === 'discovery' || link.id === 'big-board') {
    return Boolean(pathname?.includes('/futurecast/big-board'));
  }
  if (link.id === 'alerts') {
    return Boolean(pathname?.includes('/futurecast/alerts'));
  }
  if (link.id === 'fit') {
    return hash === FUTURECAST_LAB_ANCHORS.positions;
  }
  if (link.id === 'portal') {
    return hash === FUTURECAST_LAB_ANCHORS.portal;
  }
  if (link.id === 'movement') {
    return hash === FUTURECAST_LAB_ANCHORS.movement || current === 'movement';
  }
  return current === link.id;
}

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
  const subLinks = discoverySeason ? DISCOVERY_SUB_LINKS : CLOSING_CLASS_SUB_LINKS;

  return (
    <nav className="fc-futurecast-nav" aria-label="FutureCast">
      {subLinks.map((link) => (
        <a
          key={link.id}
          href={link.href}
          className={`fc-futurecast-nav__link${linkIsActive(link, pathname, current, hash) ? ' is-active' : ''}`}
          data-testid={
            link.id === 'discovery' || link.id === 'big-board'
              ? 'fc-big-board-nav'
              : link.id === 'alerts'
                ? 'fc-alerts-nav'
                : undefined
          }
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
