'use client';

import React, { useMemo } from 'react';
import { VaultGameZonePage } from '@/components/vault/VaultGameZonePage';
import { DetailPageStub } from '@/components/shell/DetailPageStub';
import { DYNAMIC_PATH_PATTERNS, segmentFromPath } from '@/lib/dynamic-path-parser';
import { SITE_ROUTES } from '@/lib/site-routes';
import { usePathname } from '@/lib/use-pathname';

export default function GameZoneDetailPage(): React.ReactElement {
  const pathname = usePathname();
  const gameId = useMemo(() => segmentFromPath(pathname, DYNAMIC_PATH_PATTERNS.gameZoneGame), [pathname]);

  if (!gameId) {
    return (
      <DetailPageStub
        title="Game not found"
        id="—"
        idLabel="Game ID"
        backHref={SITE_ROUTES.gameZone}
        backLabel="← Game Zone"
      />
    );
  }

  return <VaultGameZonePage />;
}
