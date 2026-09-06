'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageLayout } from '@/components/brand';
import { GameWeekCommandCenter } from '@/components/vault/game-week/GameWeekCommandCenter';
import { DYNAMIC_PATH_PATTERNS, segmentFromPath } from '@/lib/dynamic-path-parser';
import { defaultGameWeekId } from '@/lib/game-week-data';
import { SCHEDULE_GAMES } from '@/lib/schedule-data';
import { useUser } from '@/hooks/useUser';
import { useInsiderUnlock } from '@/lib/useUser';
import { usePathname } from '@/lib/use-pathname';

export function VaultGameWeekPage(): React.ReactElement {
  const pathname = usePathname();
  const { isInsider: insider } = useUser();
  const { href: unlockHref, navigate: goToUnlock } = useInsiderUnlock({ returnPath: pathname });
  const urlGameId = useMemo(
    () => segmentFromPath(pathname, DYNAMIC_PATH_PATTERNS.gameWeekGame),
    [pathname]
  );
  const [gameId, setGameId] = useState(defaultGameWeekId());
  const [lockToInitial, setLockToInitial] = useState(false);

  useEffect(() => {
    const fromQuery =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('game') : null;
    const raw = urlGameId || fromQuery;
    if (raw && SCHEDULE_GAMES.some((g) => g.id === raw)) {
      setGameId(raw);
      setLockToInitial(true);
    }
  }, [urlGameId]);

  return (
    <div className="rh-page rh-page--elite gv-gw-wow-page fc-lab-cc-page" data-testid="vault-game-week-elite">
      <PageLayout theme="navy" testId="vault-game-week" className="gv-gw-wow-page-layout">
        {/* Shell open for Locker; Film depth (intel + scouting) blurred inside Command Center. Trial unlocks. */}
        <GameWeekCommandCenter
          initialGameId={gameId}
          lockToInitial={lockToInitial}
          onGameChange={setGameId}
        />

        {!insider ? (
          <a
            href={unlockHref}
            className="gv-paywall-sticky-cta"
            onClick={(e) => {
              e.preventDefault();
              goToUnlock();
            }}
          >
            Unlock Film intel · Game Week depth + Scouting Report · from $9.99/mo
          </a>
        ) : null}
      </PageLayout>
    </div>
  );
}
