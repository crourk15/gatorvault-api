'use client';

import React, { useEffect, useState } from 'react';
import { PlayerDirectoryPage } from '@/components/site/PlayerDirectoryPage';
import { PlayerProfilePage } from '@/components/futurecast/player/PlayerProfilePage';

function slugFromPathname(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/\/vault\/players\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function VaultPlayersPage(): React.ReactElement {
  const [slug, setSlug] = useState<string | null>(() => slugFromPathname());

  useEffect(() => {
    setSlug(slugFromPathname());
    const onNav = () => setSlug(slugFromPathname());
    window.addEventListener('popstate', onNav);
    return () => window.removeEventListener('popstate', onNav);
  }, []);

  if (slug) {
    return <PlayerProfilePage slug={slug} />;
  }

  return <PlayerDirectoryPage inVault />;
}
