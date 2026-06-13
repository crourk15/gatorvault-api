'use client';

import React, { useEffect, useState } from 'react';
import { PlayerProfilePage } from '@/components/futurecast/player/PlayerProfilePage';

function slugFromPathname(): string {
  if (typeof window === 'undefined') return '';
  const match = window.location.pathname.match(/\/player\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function PlayerBySlugPage(): React.ReactElement {
  const [slug, setSlug] = useState('');

  useEffect(() => {
    setSlug(slugFromPathname());
  }, []);

  if (!slug) {
    return <p className="fc-profile-empty fc-player-page-wrap">Loading player…</p>;
  }

  return <PlayerProfilePage slug={slug} />;
}
