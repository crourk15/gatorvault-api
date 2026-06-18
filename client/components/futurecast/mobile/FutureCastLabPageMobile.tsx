'use client';

import React from 'react';
import type { FutureCastLabDataMap } from '@/lib/futurecast-lab-data';
import { FUTURECAST_LAB_ANCHORS } from '@/lib/vault-route-map';
import { FutureCastHero } from '@/components/futurecast/lab/FutureCastHero';
import { FutureCastTargetsPanel } from '@/components/futurecast/lab/FutureCastTargetsPanel';
import { FutureCastBattlesPanel } from '@/components/futurecast/lab/FutureCastBattlesPanel';
import { FutureCastAnalystSignals } from '@/components/futurecast/lab/FutureCastAnalystSignals';
import { FutureCastMovementPanel } from '@/components/futurecast/lab/FutureCastMovementPanel';
import { FutureCastPositionBreakdown } from '@/components/futurecast/lab/FutureCastPositionBreakdown';
import { FutureCastPortalCrossView } from '@/components/futurecast/lab/FutureCastPortalCrossView';
import { FutureCastLiveFeed } from '@/components/futurecast/lab/FutureCastLiveFeed';

type Props = {
  data: FutureCastLabDataMap;
};

/**
 * Mobile FutureCast Lab layout (<1024px).
 * Same route `/vault/futurecast` — vertical stack with full-width cards.
 */
export function FutureCastLabPageMobile({ data }: Props): React.ReactElement {
  return (
    <div className="fc-lab-mobile mobile-app" data-testid="fc-lab-page-mobile">
      <section id={FUTURECAST_LAB_ANCHORS.overview}>
        <FutureCastHero
          summary={data.summary}
          metrics={data.metrics}
          heatLevel={data.heatLevel}
          masterBoard={data.masterBoard}
          movementIntel={data.movementIntel}
          lastUpdated={data.lastUpdated}
        />
      </section>
      <section id={FUTURECAST_LAB_ANCHORS.masterBoard}>
        <FutureCastTargetsPanel masterBoard={data.masterBoard} />
      </section>
      <section id={FUTURECAST_LAB_ANCHORS.trending}>
        <FutureCastBattlesPanel masterBoard={data.masterBoard} trendingBoard={data.trendingBoard} />
      </section>
      <section id={FUTURECAST_LAB_ANCHORS.movement}>
        <FutureCastMovementPanel movementIntel={data.movementIntel} />
      </section>
      <section id={FUTURECAST_LAB_ANCHORS.signals}>
        <FutureCastAnalystSignals staffNotes={data.staffNotes} masterBoard={data.masterBoard} />
      </section>
      <section id={FUTURECAST_LAB_ANCHORS.positions}>
        <FutureCastPositionBreakdown
          players={data.masterBoard.players}
          activePredictions={data.metrics.activePredictions}
        />
      </section>
      <section id={FUTURECAST_LAB_ANCHORS.portal}>
        <FutureCastPortalCrossView
          portalPlayers={data.home.portalWatchlist ?? []}
          masterBoard={data.masterBoard}
        />
      </section>
      <section id={FUTURECAST_LAB_ANCHORS.feed}>
        <FutureCastLiveFeed
          masterBoard={data.masterBoard}
          staffNotes={data.staffNotes}
          movementIntel={data.movementIntel}
        />
      </section>
    </div>
  );
}
