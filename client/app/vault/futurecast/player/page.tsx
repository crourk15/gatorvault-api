'use client';

import React, { useMemo } from 'react';
import { PlayerProfilePage } from '@/components/futurecast/player/PlayerProfilePage';
import { usePathname } from '@/lib/use-pathname';

function slugFromPathname(pathname: string): string {
  const match = pathname.match(/\/vault\/futurecast\/player\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function VaultFutureCastPlayerPage(): React.ReactElement {
  const pathname = usePathname();
  const slug = useMemo(() => slugFromPathname(pathname), [pathname]);

  if (!slug) {
    return <p className="fc-profile-empty fc-player-page-wrap">Loading player…</p>;
  }

  return <PlayerProfilePage slug={slug} />;
}
