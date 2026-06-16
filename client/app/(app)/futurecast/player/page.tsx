'use client';

import React, { useMemo } from 'react';
import { PlayerProfilePage } from '@/components/futurecast/player/PlayerProfilePage';
import { UiError } from '@/components/site/UiMessage';
import { DYNAMIC_PATH_PATTERNS, segmentFromPath } from '@/lib/dynamic-path-parser';
import { SITE_ROUTES } from '@/lib/site-routes';
import { usePathname } from '@/lib/use-pathname';

export default function FutureCastPlayerPage(): React.ReactElement {
  const pathname = usePathname();
  const slug = useMemo(
    () =>
      segmentFromPath(pathname, DYNAMIC_PATH_PATTERNS.futurecastPlayer) ||
      segmentFromPath(pathname, DYNAMIC_PATH_PATTERNS.vaultFuturecastPlayer),
    [pathname]
  );

  if (!slug) {
    return (
      <UiError
        title="Player not found"
        message="No player slug in this URL."
        backHref={SITE_ROUTES.futurecast}
        backLabel="← FutureCast"
      />
    );
  }

  return <PlayerProfilePage slug={slug} />;
}
