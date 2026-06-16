'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PlayerDirectoryPage } from '@/components/site/PlayerDirectoryPage';
import { PlayerProfilePage } from '@/components/futurecast/player/PlayerProfilePage';
import { RosterProfilePage } from '@/components/vault/RosterProfilePage';
import type { RosterPlayer } from '@/lib/roster-api';
import { vaultTeamBackHref } from '@/lib/vault-navigation';
import { usePathname } from '@/lib/use-pathname';

function slugFromPathname(pathname: string): string {
  const match = pathname.match(/\/vault\/players\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function VaultPlayersPage(): React.ReactElement {
  const pathname = usePathname();
  const slug = useMemo(() => slugFromPathname(pathname), [pathname]);
  const [rosterPlayer, setRosterPlayer] = useState<RosterPlayer | null>(null);
  const [loading, setLoading] = useState(false);
  const [useFcProfile, setUseFcProfile] = useState(false);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setRosterPlayer(null);
      setUseFcProfile(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    import('@/lib/player-profile-resolver').then(({ resolvePlayerProfile }) =>
      resolvePlayerProfile(slug, true)
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
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug) {
    return <PlayerDirectoryPage inVault />;
  }

  if (loading) {
    return <p className="fc-profile-empty">Loading player…</p>;
  }

  if (rosterPlayer && !useFcProfile) {
    return (
      <RosterProfilePage
        player={rosterPlayer}
        backHref={vaultTeamBackHref()}
        backLabel="← Team"
      />
    );
  }

  return <PlayerProfilePage slug={slug} backHref={vaultTeamBackHref()} backLabel="← Team" />;
}
