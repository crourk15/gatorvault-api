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
import { LazyMountSection } from '@/components/shared/LazyMountSection';

type Props = {
  data: FutureCastLabDataMap;
};

/**
 * Mobile FutureCast Lab layout (<1024px).
 * Matches Recruiting Hub: full-bleed compact hero + single rh-frame gutter for panels.
 */
export function FutureCastLabPageMobile({ data }: Props): React.ReactElement {
  return (
    <>
      <section id={FUTURECAST_LAB_ANCHORS.overview} className="fc-lab-mobile-hero">
        <FutureCastHero
          compact
          summary={data.summary}
          metrics={data.metrics}
          heatLevel={data.heatLevel}
          masterBoard={data.masterBoard}
          movementIntel={data.movementIntel}
          lastUpdated={data.lastUpdated}
        />
      </section>
      <div className="fc-lab-mobile rh-frame" data-testid="fc-lab-page-mobile">
        <LazyMountSection id={FUTURECAST_LAB_ANCHORS.masterBoard}>
          <FutureCastTargetsPanel bare masterBoard={data.masterBoard} />
        </LazyMountSection>
        <LazyMountSection id={FUTURECAST_LAB_ANCHORS.trending}>
          <FutureCastBattlesPanel bare masterBoard={data.masterBoard} trendingBoard={data.trendingBoard} />
        </LazyMountSection>
        <LazyMountSection id={FUTURECAST_LAB_ANCHORS.movement}>
          <FutureCastMovementPanel bare movementIntel={data.movementIntel} />
        </LazyMountSection>
        <LazyMountSection id={FUTURECAST_LAB_ANCHORS.signals}>
          <FutureCastAnalystSignals bare staffNotes={data.staffNotes} masterBoard={data.masterBoard} />
        </LazyMountSection>
        <LazyMountSection id={FUTURECAST_LAB_ANCHORS.positions}>
          <FutureCastPositionBreakdown
            bare
            players={data.masterBoard.players}
            activePredictions={data.metrics.activePredictions}
          />
        </LazyMountSection>
        <LazyMountSection id={FUTURECAST_LAB_ANCHORS.portal}>
          <FutureCastPortalCrossView
            bare
            portalPlayers={data.home.portalWatchlist ?? []}
            masterBoard={data.masterBoard}
          />
        </LazyMountSection>
        <LazyMountSection id={FUTURECAST_LAB_ANCHORS.feed}>
          <FutureCastLiveFeed
            masterBoard={data.masterBoard}
            staffNotes={data.staffNotes}
            movementIntel={data.movementIntel}
          />
        </LazyMountSection>
      </div>
    </>
  );
}
