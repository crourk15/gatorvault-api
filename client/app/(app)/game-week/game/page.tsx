'use client';

import React, { useMemo } from 'react';
import { DetailPageStub } from '@/components/shell/DetailPageStub';
import { Button } from '@/components/ui/Button';
import { DYNAMIC_PATH_PATTERNS, segmentFromPath } from '@/lib/dynamic-path-parser';
import { SITE_ROUTES, gameZoneRoute } from '@/lib/site-routes';
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
    <DetailPageStub
      title="Game Week"
      id={gameId}
      idLabel="Game"
      backHref={SITE_ROUTES.gameWeek}
      backLabel="← Game Week"
    >
      <p style={{ marginBottom: '1rem', color: '#94a3b8' }}>
        Countdown, matchup intel, and keys to watch for this opponent.
      </p>
      <Button href={gameZoneRoute(gameId)} variant="primary">
        Enter Game Zone on game day →
      </Button>
    </DetailPageStub>
  );
}
