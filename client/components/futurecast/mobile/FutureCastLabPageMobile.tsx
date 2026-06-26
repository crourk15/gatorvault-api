'use client';

import React from 'react';
import type { FutureCastLabData } from '@/components/futurecast/lab/useFutureCastLabData';
import type { FutureCastPanelSkeleton } from '@/components/futurecast/FutureCastLabSkeleton';
import { FUTURECAST_LAB_ANCHORS } from '@/lib/vault-route-map';
import { FutureCastHero } from '@/components/futurecast/lab/FutureCastHero';
import { FutureCastTargetsPanel } from '@/components/futurecast/lab/FutureCastTargetsPanel';
import { FutureCastBattlesPanel } from '@/components/futurecast/lab/FutureCastBattlesPanel';
import { FutureCastAnalystSignals } from '@/components/futurecast/lab/FutureCastAnalystSignals';
import { FutureCastMovementPanel } from '@/components/futurecast/lab/FutureCastMovementPanel';
import { FutureCastPositionBreakdown } from '@/components/futurecast/lab/FutureCastPositionBreakdown';
import { FutureCastPortalCrossView } from '@/components/futurecast/lab/FutureCastPortalCrossView';
import { FutureCastLiveFeed } from '@/components/futurecast/lab/FutureCastLiveFeed';
import { FutureCastExtendedModules } from '@/components/futurecast/lab/FutureCastExtendedModules';

type Props = {
  lab: FutureCastLabData;
  PanelSkeleton: typeof FutureCastPanelSkeleton;
};

/**
 * Mobile FutureCast Lab — mirrors RecruitingHubCommandCenter:
 * hero + rh-cc-module stack + full-bleed live feed (same rhythm as RH).
 */
export function FutureCastLabPageMobile({ lab, PanelSkeleton }: Props): React.ReactElement {
  const data = lab;
  const pending = lab.secondaryLoading;

  return (
    <div className="rh-cc-page fc-lab-cc-page" data-testid="fc-lab-page-mobile">
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
        <div className="rh-cc-col">
          <section id={FUTURECAST_LAB_ANCHORS.masterBoard}>
            <FutureCastTargetsPanel masterBoard={data.masterBoard} />
          </section>
          <section id={FUTURECAST_LAB_ANCHORS.trending}>
            {pending ? (
              <PanelSkeleton minHeight={240} />
            ) : (
              <FutureCastBattlesPanel masterBoard={data.masterBoard} trendingBoard={data.trendingBoard} />
            )}
          </section>
          <section id={FUTURECAST_LAB_ANCHORS.movement}>
            {pending ? (
              <PanelSkeleton minHeight={260} />
            ) : (
              <FutureCastMovementPanel movementIntel={data.movementIntel} />
            )}
          </section>
          <section id={FUTURECAST_LAB_ANCHORS.signals}>
            {pending ? (
              <PanelSkeleton minHeight={200} />
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
          <section id="fc-lab-extended">
            {pending ? (
              <PanelSkeleton minHeight={280} />
            ) : (
              <FutureCastExtendedModules
                masterBoard={data.masterBoard}
                trendingBoard={data.trendingBoard}
                movementIntel={data.movementIntel}
                highPriority={data.highPriority}
                visitIntel={data.visitIntel}
                visitRecap={data.visitRecap}
                flipWatch={data.flipWatch}
                movementNarratives={data.movementNarratives}
                staffNotes={data.staffNotes}
                underclassmen={data.underclassmen}
              />
            )}
          </section>
          <section id={FUTURECAST_LAB_ANCHORS.portal}>
            {pending ? (
              <PanelSkeleton minHeight={180} />
            ) : (
              <FutureCastPortalCrossView
                portalPlayers={data.home.portalWatchlist ?? []}
                masterBoard={data.masterBoard}
              />
            )}
          </section>
        </div>
      </div>

      <section id={FUTURECAST_LAB_ANCHORS.feed}>
        {pending ? (
          <PanelSkeleton minHeight={160} />
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
