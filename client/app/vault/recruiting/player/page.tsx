'use client';

import React, { useEffect, useState } from 'react';
import { PlayerProfilePage } from '@/components/futurecast/player/PlayerProfilePage';
import { useHydrated } from '@/hooks/useHydrated';

function slugFromPathname(): string {
  if (typeof window === 'undefined') return '';
  const match = window.location.pathname.match(/\/vault\/recruiting\/player\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
}

/** Recruiting-context player profile — same component as FutureCast/roster routes. */
export default function VaultRecruitingPlayerPage(): React.ReactElement {
  const hydrated = useHydrated();
  const [slug, setSlug] = useState('');

  useEffect(() => {
    setSlug(slugFromPathname());
    const onNav = () => setSlug(slugFromPathname());
    window.addEventListener('popstate', onNav);
    window.addEventListener('vault:navigation', onNav);
    return () => {
      window.removeEventListener('popstate', onNav);
      window.removeEventListener('vault:navigation', onNav);
    };
  }, []);

  if (!hydrated || !slug) {
    return <p className="fc-profile-empty fc-player-page-wrap">Loading player…</p>;
  }

  return <PlayerProfilePage slug={slug} />;
}
