'use client';

import React, { useEffect } from 'react';
import { PlayerProfilePage } from '@/components/futurecast/player/PlayerProfilePage';
import { ProfileSkeleton } from '@/components/futurecast/player/ProfileSkeleton';
import { RosterProfilePage } from '@/components/vault/RosterProfilePage';
import { UiError } from '@/components/site/UiMessage';
import {
  usePlayerProfileRoute,
  type PlayerProfileRouteState,
} from '@/hooks/usePlayerProfileRoute';
import type { ProfileRouteContext } from '@/lib/player-full-profile-api';
import { ensureDocumentScrollUnlocked } from '@/lib/body-scroll-lock';
import '@/lib/futurecast.css';

type Props = {
  slug: string;
  context?: ProfileRouteContext;
  backHref: string;
  backLabel: string;
  rosterBackHref?: string;
  rosterBackLabel?: string;
};

function ProfileRouteSkeleton({
  backHref,
  backLabel,
}: {
  backHref: string;
  backLabel: string;
}): React.ReactElement {
  return (
    <div className="fc-profile-page fc-profile-page--feed mobile-app" data-testid="player-profile-page">
      <nav className="fc-profile-back">
        <a href={backHref}>{backLabel}</a>
      </nav>
      <ProfileSkeleton />
    </div>
  );
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

  useEffect(() => {
    ensureDocumentScrollUnlocked();
  }, [slug]);

  if (route.phase === 'loading' || route.phase === 'redirect') {
    return <ProfileRouteSkeleton backHref={backHref} backLabel={backLabel} />;
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
      playerId={route.playerId || undefined}
      backHref={backHref}
      backLabel={backLabel}
      recruitingContext={context === 'recruiting'}
    />
  );
}
