'use client';

import React, { useMemo } from 'react';
import { PlayerProfilePage } from '@/components/futurecast/player/PlayerProfilePage';
import { UiError } from '@/components/site/UiMessage';
import { PLAYER_SLUG_PATTERNS, playerSlugFromPath } from '@/lib/player-slug-from-path';
import { usePathname } from '@/lib/use-pathname';

/** Recruiting-context player profile — same component as FutureCast/roster routes. */
export default function VaultRecruitingPlayerPage(): React.ReactElement {
  const pathname = usePathname();
  const slug = useMemo(
    () => playerSlugFromPath(pathname, PLAYER_SLUG_PATTERNS.recruiting),
    [pathname]
  );

  if (!slug) {
    return (
      <UiError
        title="Player not found"
        message="No player slug in this URL."
        backHref="/vault/recruiting"
        backLabel="← Recruiting Hub"
      />
    );
  }

  return <PlayerProfilePage slug={slug} />;
}
