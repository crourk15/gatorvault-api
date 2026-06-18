'use client';

import React from 'react';
import type { FutureCastLabDataMap } from '@/lib/futurecast-lab-data';
import { FutureCastHero } from './FutureCastHero';
import { FutureCastTargetsPanel } from './FutureCastTargetsPanel';
import { FutureCastBattlesPanel } from './FutureCastBattlesPanel';
import { FutureCastAnalystSignals } from './FutureCastAnalystSignals';
import { FutureCastMovementPanel } from './FutureCastMovementPanel';
import { FutureCastPositionBreakdown } from './FutureCastPositionBreakdown';
import { FutureCastPortalCrossView } from './FutureCastPortalCrossView';
import { FutureCastLiveFeed } from './FutureCastLiveFeed';

type Props = {
  data: FutureCastLabDataMap;
};

export function FutureCastLabPageDesktop({ data }: Props): React.ReactElement {
  return (
    <div className="fc-lab-page" data-testid="fc-lab-page-desktop">
      <div id="fc-hero">
        <FutureCastHero
          summary={data.summary}
          metrics={data.metrics}
          heatLevel={data.heatLevel}
          masterBoard={data.masterBoard}
          movementIntel={data.movementIntel}
          lastUpdated={data.lastUpdated}
        />
      </div>

      <div className="fc-lab-main fc-lab-main--stacked rh-frame">
        <section id="fc-master">
          <FutureCastTargetsPanel masterBoard={data.masterBoard} />
        </section>
        <section id="fc-trending">
          <FutureCastBattlesPanel masterBoard={data.masterBoard} trendingBoard={data.trendingBoard} />
        </section>
        <section id="fc-signals">
          <FutureCastAnalystSignals staffNotes={data.staffNotes} masterBoard={data.masterBoard} />
        </section>
        <section id="fc-movement">
          <FutureCastMovementPanel movementIntel={data.movementIntel} />
        </section>
        <section id="fc-positions">
          <FutureCastPositionBreakdown
            players={data.masterBoard.players}
            activePredictions={data.metrics.activePredictions}
          />
        </section>
        <section id="fc-portal">
          <FutureCastPortalCrossView
            portalPlayers={data.home.portalWatchlist ?? []}
            masterBoard={data.masterBoard}
          />
        </section>
      </div>

      <div id="fc-feed">
        <FutureCastLiveFeed
          masterBoard={data.masterBoard}
          staffNotes={data.staffNotes}
          movementIntel={data.movementIntel}
        />
      </div>
    </div>
  );
}
