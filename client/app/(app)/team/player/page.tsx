'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PlayerProfilePage } from '@/components/futurecast/player/PlayerProfilePage';
import { RosterProfilePage } from '@/components/vault/RosterProfilePage';
import { UiError } from '@/components/site/UiMessage';
import type { RosterPlayer } from '@/lib/roster-api';
import { DYNAMIC_PATH_PATTERNS, segmentFromPath } from '@/lib/dynamic-path-parser';
import { SITE_ROUTES } from '@/lib/site-routes';
import { usePathname } from '@/lib/use-pathname';

type ProfileKind = 'pending' | 'roster' | 'futurecast';

export default function TeamPlayerPage(): React.ReactElement {
  const pathname = usePathname();
  const slug = useMemo(
    () =>
      segmentFromPath(pathname, DYNAMIC_PATH_PATTERNS.teamPlayer) ||
      segmentFromPath(pathname, DYNAMIC_PATH_PATTERNS.vaultTeamPlayer),
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
    return (
      <UiError
        title="Player not found"
        message="No player slug in this URL."
        backHref={SITE_ROUTES.team}
        backLabel="← Team"
      />
    );
  }

  if (profileKind === 'roster' && rosterPlayer) {
    return (
      <RosterProfilePage
        player={rosterPlayer}
        backHref={SITE_ROUTES.team}
        backLabel="← Team"
      />
    );
  }

  return (
    <PlayerProfilePage slug={slug} backHref={SITE_ROUTES.team} backLabel="← Team" />
  );
}
