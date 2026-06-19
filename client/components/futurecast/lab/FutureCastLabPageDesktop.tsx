'use client';

import React from 'react';
import type { FutureCastLabDataMap } from '@/lib/futurecast-lab-data';
import { FUTURECAST_LAB_ANCHORS } from '@/lib/vault-route-map';
import { FutureCastHero } from './FutureCastHero';
import { FutureCastTargetsPanel } from './FutureCastTargetsPanel';
import { FutureCastBattlesPanel } from './FutureCastBattlesPanel';
import { FutureCastAnalystSignals } from './FutureCastAnalystSignals';
import { FutureCastMovementPanel } from './FutureCastMovementPanel';
import { FutureCastPositionBreakdown } from './FutureCastPositionBreakdown';
import { FutureCastPortalCrossView } from './FutureCastPortalCrossView';
import { FutureCastLiveFeed } from './FutureCastLiveFeed';
import { FutureCastExtendedModules } from './FutureCastExtendedModules';

type Props = {
  data: FutureCastLabDataMap;
};

/** Desktop FutureCast Lab — UF Premium command center (RH 2-column grid). */
export function FutureCastLabPageDesktop({ data }: Props): React.ReactElement {
  return (
    <div className="rh-cc-page fc-lab-cc-page" data-testid="fc-lab-page-desktop">
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

      <div className="rh-cc-main rh-frame">
        <div className="rh-cc-col rh-cc-col--left">
          <section id={FUTURECAST_LAB_ANCHORS.masterBoard}>
            <FutureCastTargetsPanel masterBoard={data.masterBoard} />
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
        </div>

        <div className="rh-cc-col rh-cc-col--right">
          <section id={FUTURECAST_LAB_ANCHORS.trending}>
            <FutureCastBattlesPanel masterBoard={data.masterBoard} trendingBoard={data.trendingBoard} />
          </section>
          <section id={FUTURECAST_LAB_ANCHORS.portal}>
            <FutureCastPortalCrossView
              portalPlayers={data.home.portalWatchlist ?? []}
              masterBoard={data.masterBoard}
            />
          </section>
          <section id="fc-lab-extended">
            <FutureCastExtendedModules
              masterBoard={data.masterBoard}
              trendingBoard={data.trendingBoard}
              movementIntel={data.movementIntel}
              highPriority={data.highPriority}
              underclassmen={data.underclassmen}
            />
          </section>
        </div>
      </div>

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
