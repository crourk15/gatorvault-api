'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageLayout } from '@/components/brand';
import { GameWeekCommandCenter } from '@/components/vault/game-week/GameWeekCommandCenter';
import { InsiderPaywall } from '@/components/futurecast/InsiderPaywall';
import { DYNAMIC_PATH_PATTERNS, segmentFromPath } from '@/lib/dynamic-path-parser';
import { SCHEDULE_GAMES } from '@/lib/schedule-data';
import { usePathname } from '@/lib/use-pathname';
import { isFilmRoomInsider } from '@/lib/futurecast-insider';

const GAME_WEEK_PAYWALL = {
  message:
    'Game Week unlocks matchup intel, opponent film prep, swing-player notes, and GatorVault predictions.',
  ctaLabel: 'Unlock Game Week + Film Room',
} as const;

export function VaultGameWeekPage(): React.ReactElement {
  const pathname = usePathname();
  const insider = isFilmRoomInsider();
  const urlGameId = useMemo(
    () => segmentFromPath(pathname, DYNAMIC_PATH_PATTERNS.gameWeekGame),
    [pathname]
  );
  const [gameId, setGameId] = useState('fau');

  useEffect(() => {
    if (urlGameId && SCHEDULE_GAMES.some((g) => g.id === urlGameId)) {
      setGameId(urlGameId);
    }
  }, [urlGameId]);

  return (
    <div className="rh-page rh-page--elite gv-gw-wow-page fc-lab-cc-page" data-testid="vault-game-week-elite">
      <PageLayout theme="navy" testId="vault-game-week" className="gv-gw-wow-page-layout">
        <InsiderPaywall variant="overlay" {...GAME_WEEK_PAYWALL}>
          <GameWeekCommandCenter initialGameId={gameId} onGameChange={setGameId} />
        </InsiderPaywall>

        {!insider ? (
          <a href="/join?tier=film" className="gv-paywall-sticky-cta">
            Unlock Game Week + Film Room · from $9.99/mo
          </a>
        ) : null}
      </PageLayout>
    </div>
  );
}
