'use client';

import React, { useMemo } from 'react';
import { VaultPlayerProfileRoute } from '@/components/vault/VaultPlayerProfileRoute';
import { UiError } from '@/components/site/UiMessage';
import { PLAYER_SLUG_PATTERNS, playerSlugFromPath } from '@/lib/player-slug-from-path';
import { usePathname } from '@/lib/use-pathname';

export default function FutureCastPlayerClient(): React.ReactElement {
  const pathname = usePathname();
  const slug = useMemo(
    () => playerSlugFromPath(pathname, PLAYER_SLUG_PATTERNS.futurecast),
    [pathname]
  );

  if (!slug) {
    return (
      <UiError
        title="Player not found"
        message="No player slug in this URL."
        backHref="/vault/futurecast"
        backLabel="← FutureCast"
      />
    );
  }

  return (
    <VaultPlayerProfileRoute
      slug={slug}
      context="futurecast"
      backHref="/vault/futurecast"
      backLabel="← FutureCast"
    />
  );
}
