'use client';

import React, { useEffect, useState } from 'react';
import { PlayerProfilePage } from '@/components/futurecast/player/PlayerProfilePage';

function slugFromPathname(): string {
  if (typeof window === 'undefined') return '';
  const match = window.location.pathname.match(/\/vault\/recruiting\/player\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
}

/** Recruiting-context player profile — same component as FutureCast/roster routes. */
export default function VaultRecruitingPlayerPage(): React.ReactElement {
  const [slug, setSlug] = useState(() => slugFromPathname());

  useEffect(() => {
    setSlug(slugFromPathname());
    const onNav = () => setSlug(slugFromPathname());
    window.addEventListener('popstate', onNav);
    return () => window.removeEventListener('popstate', onNav);
  }, []);

  if (!slug) {
    return <p className="fc-profile-empty fc-player-page-wrap">Loading player…</p>;
  }

  return <PlayerProfilePage slug={slug} />;
}
