'use client';

import React from 'react';
import type { FutureCastLabData } from '@/components/futurecast/lab/useFutureCastLabData';
import type { FutureCastPanelSkeleton } from '@/components/futurecast/FutureCastLabSkeleton';
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
  lab: FutureCastLabData;
  PanelSkeleton: typeof FutureCastPanelSkeleton;
};

/** Desktop FutureCast Lab — UF Premium command center (RH 2-column grid). */
export function FutureCastLabPageDesktop({ lab, PanelSkeleton }: Props): React.ReactElement {
  const data = lab;
  const pending = lab.secondaryLoading;

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
            {pending ? (
              <PanelSkeleton minHeight={280} />
            ) : (
              <FutureCastMovementPanel movementIntel={data.movementIntel} />
            )}
          </section>
          <section id={FUTURECAST_LAB_ANCHORS.signals}>
            {pending ? (
              <PanelSkeleton minHeight={220} />
            ) : (
              <FutureCastAnalystSignals staffNotes={data.staffNotes} masterBoard={data.masterBoard} />
            )}
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
            {pending ? (
              <PanelSkeleton minHeight={260} />
            ) : (
              <FutureCastBattlesPanel masterBoard={data.masterBoard} trendingBoard={data.trendingBoard} />
            )}
          </section>
          <section id={FUTURECAST_LAB_ANCHORS.portal}>
            {pending ? (
              <PanelSkeleton minHeight={200} />
            ) : (
              <FutureCastPortalCrossView
                portalPlayers={data.home.portalWatchlist ?? []}
                masterBoard={data.masterBoard}
              />
            )}
          </section>
          <section id="fc-lab-extended">
            {pending ? (
              <PanelSkeleton minHeight={320} />
            ) : (
              <FutureCastExtendedModules
                masterBoard={data.masterBoard}
                trendingBoard={data.trendingBoard}
                movementIntel={data.movementIntel}
                highPriority={data.highPriority}
                visitIntel={data.visitIntel}
                underclassmen={data.underclassmen}
              />
            )}
          </section>
        </div>
      </div>

      <section id={FUTURECAST_LAB_ANCHORS.feed}>
        {pending ? (
          <PanelSkeleton minHeight={180} />
        ) : (
          <FutureCastLiveFeed
            masterBoard={data.masterBoard}
            staffNotes={data.staffNotes}
            movementIntel={data.movementIntel}
          />
        )}
      </section>
    </div>
  );
}
