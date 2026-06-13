'use client';

import React, { useEffect, useState } from 'react';
import { PlayerDirectoryPage } from '@/components/site/PlayerDirectoryPage';
import { PlayerProfilePage } from '@/components/futurecast/player/PlayerProfilePage';
import { RosterProfilePage } from '@/components/vault/RosterProfilePage';
import type { RosterPlayer } from '@/lib/roster-api';

function slugFromPathname(): string {
  if (typeof window === 'undefined') return '';
  const match = window.location.pathname.match(/\/vault\/players\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function VaultPlayersPage(): React.ReactElement {
  const [slug, setSlug] = useState(() => slugFromPathname());
  const [rosterPlayer, setRosterPlayer] = useState<RosterPlayer | null>(null);
  const [loading, setLoading] = useState(!!slugFromPathname());
  const [useFcProfile, setUseFcProfile] = useState(false);

  useEffect(() => {
    const next = slugFromPathname();
    setSlug(next);
    if (!next) {
      setLoading(false);
      setRosterPlayer(null);
      setUseFcProfile(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    import('@/lib/player-profile-resolver').then(({ resolvePlayerProfile }) =>
      resolvePlayerProfile(next, true)
        .then((result) => {
          if (cancelled) return;
          if (result.kind === 'redirect') {
            window.location.replace(result.href);
            return;
          }
          if (result.kind === 'roster') {
            setRosterPlayer(result.player);
            setUseFcProfile(false);
          } else {
            setRosterPlayer(null);
            setUseFcProfile(true);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setUseFcProfile(true);
            setRosterPlayer(null);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        })
    );
    const onNav = () => setSlug(slugFromPathname());
    window.addEventListener('popstate', onNav);
    return () => {
      cancelled = true;
      window.removeEventListener('popstate', onNav);
    };
  }, []);

  if (!slug) {
    return <PlayerDirectoryPage inVault />;
  }

  if (loading) {
    return <p className="fc-profile-empty">Loading player…</p>;
  }

  if (rosterPlayer && !useFcProfile) {
    return <RosterProfilePage player={rosterPlayer} />;
  }

  return <PlayerProfilePage slug={slug} backHref="/vault/team" backLabel="← Team" />;
}
