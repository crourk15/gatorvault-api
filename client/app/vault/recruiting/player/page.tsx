'use client';

import React, { useMemo } from 'react';
import { PlayerProfilePage } from '@/components/futurecast/player/PlayerProfilePage';
import { usePathname } from '@/lib/use-pathname';

function slugFromPathname(pathname: string): string {
  const match = pathname.match(/\/vault\/recruiting\/player\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
}

/** Recruiting-context player profile — same component as FutureCast/roster routes. */
export default function VaultRecruitingPlayerPage(): React.ReactElement {
  const pathname = usePathname();
  const slug = useMemo(() => slugFromPathname(pathname), [pathname]);

  if (!slug) {
    return <p className="fc-profile-empty fc-player-page-wrap">Loading player…</p>;
  }

  return <PlayerProfilePage slug={slug} />;
}
