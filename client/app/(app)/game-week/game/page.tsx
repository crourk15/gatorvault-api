'use client';

import React, { useMemo } from 'react';
import { VaultGameWeekPage } from '@/components/vault/VaultGameWeekPage';
import { DetailPageStub } from '@/components/shell/DetailPageStub';
import { DYNAMIC_PATH_PATTERNS, segmentFromPath } from '@/lib/dynamic-path-parser';
import { SITE_ROUTES } from '@/lib/site-routes';
import { usePathname } from '@/lib/use-pathname';

export default function GameWeekDetailPage(): React.ReactElement {
  const pathname = usePathname();
  const gameId = useMemo(() => segmentFromPath(pathname, DYNAMIC_PATH_PATTERNS.gameWeekGame), [pathname]);

  if (!gameId) {
    return (
      <DetailPageStub
        title="Game not found"
        id="—"
        idLabel="Game ID"
        backHref={SITE_ROUTES.gameWeek}
        backLabel="← Game Week"
      />
    );
  }

  return (
    <>
      <VaultGameWeekPage />
      <DetailPageStub
        title="Game Week Detail"
        id={gameId}
        idLabel="Game"
        backHref={SITE_ROUTES.gameWeek}
        backLabel="← All Game Week"
      />
    </>
  );
}
