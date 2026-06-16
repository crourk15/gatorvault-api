'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PlayerDirectoryPage } from '@/components/site/PlayerDirectoryPage';
import { PlayerProfilePage } from '@/components/futurecast/player/PlayerProfilePage';
import { RosterProfilePage } from '@/components/vault/RosterProfilePage';
import type { RosterPlayer } from '@/lib/roster-api';
import { vaultTeamBackHref } from '@/lib/vault-navigation';
import { PLAYER_SLUG_PATTERNS, playerSlugFromPath } from '@/lib/player-slug-from-path';
import { usePathname } from '@/lib/use-pathname';

type ProfileKind = 'pending' | 'roster' | 'futurecast';

export default function VaultPlayersPage(): React.ReactElement {
  const pathname = usePathname();
  const slug = useMemo(
    () => playerSlugFromPath(pathname, PLAYER_SLUG_PATTERNS.roster),
    [pathname]
  );
  const [rosterPlayer, setRosterPlayer] = useState<RosterPlayer | null>(null);
  const [profileKind, setProfileKind] = useState<ProfileKind>('pending');

  useEffect(() => {
    if (!slug) {
      setProfileKind('pending');
      setRosterPlayer(null);
      return;
    }
    let cancelled = false;
    setProfileKind('pending');
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
            setProfileKind('roster');
          } else {
            setRosterPlayer(null);
            setProfileKind('futurecast');
          }
        })
        .catch(() => {
          if (!cancelled) setProfileKind('futurecast');
        })
    );
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug) {
    return <PlayerDirectoryPage inVault />;
  }

  if (profileKind === 'roster' && rosterPlayer) {
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
