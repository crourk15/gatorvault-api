'use client';

import React from 'react';
import { PlayerProfilePage } from '@/components/futurecast/player/PlayerProfilePage';
import { RosterProfilePage } from '@/components/vault/RosterProfilePage';
import { UiError } from '@/components/site/UiMessage';
import {
  usePlayerProfileRoute,
  type PlayerProfileRouteState,
} from '@/hooks/usePlayerProfileRoute';
import type { ProfileRouteContext } from '@/lib/player-full-profile-api';

type Props = {
  slug: string;
  context?: ProfileRouteContext;
  backHref: string;
  backLabel: string;
  rosterBackHref?: string;
  rosterBackLabel?: string;
};

function ProfileRouteSkeleton(): React.ReactElement {
  return <p className="rh-page__status rh-container">Loading player profile…</p>;
}

export function VaultPlayerProfileRoute({
  slug,
  context = 'auto',
  backHref,
  backLabel,
  rosterBackHref,
  rosterBackLabel,
}: Props): React.ReactElement {
  const route: PlayerProfileRouteState = usePlayerProfileRoute(slug, context);

  if (route.phase === 'loading' || route.phase === 'redirect') {
    return <ProfileRouteSkeleton />;
  }

  if (route.phase === 'error') {
    return (
      <UiError
        title="Player not found"
        message={route.message}
        backHref={backHref}
        backLabel={backLabel}
      />
    );
  }

  if (route.phase === 'roster') {
    return (
      <RosterProfilePage
        player={route.roster}
        backHref={rosterBackHref ?? backHref}
        backLabel={rosterBackLabel ?? backLabel}
      />
    );
  }

  return (
    <PlayerProfilePage
      slug={route.canonicalSlug}
      playerId={route.playerId}
      backHref={backHref}
      backLabel={backLabel}
      recruitingContext={context === 'recruiting'}
    />
  );
}
