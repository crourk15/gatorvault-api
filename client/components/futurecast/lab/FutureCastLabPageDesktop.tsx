'use client';

import React from 'react';
import type { FutureCastLabData } from '@/components/futurecast/lab/useFutureCastLabData';
import type { FutureCastPanelSkeleton } from '@/components/futurecast/FutureCastLabSkeleton';
import { FUTURECAST_LAB_ANCHORS } from '@/lib/vault-route-map';
import { useResolvedLabHighPriority } from './FutureCastLabCycleContext';
import { FutureCastHero } from './FutureCastHero';
import { FutureCastTargetsPanel } from './FutureCastTargetsPanel';
import { FutureCastFlipWatchPanel } from './FutureCastFlipWatchPanel';
import { FutureCastMovementPanel } from './FutureCastMovementPanel';
import { FutureCastPositionBreakdown } from './FutureCastPositionBreakdown';
import { FutureCastPortalCrossView } from './FutureCastPortalCrossView';
import { FutureCastLiveFeed } from './FutureCastLiveFeed';
import { FutureCastExtendedModules } from './FutureCastExtendedModules';

type Props = {
  lab: FutureCastLabData;
  PanelSkeleton: typeof FutureCastPanelSkeleton;
};

/**
 * Desktop FutureCast Lab — Targets + slim Battles beside Fit (full frame width).
 */
export function FutureCastLabPageDesktop({ lab, PanelSkeleton }: Props): React.ReactElement {
  const data = lab;
  const highPriority = useResolvedLabHighPriority(data.highPriority, data.highPriorityClosing);
  // Elite: never blank seeded panels behind secondaryLoading — only skeleton when empty.
  const hasSeededBoard =
    (data.masterBoard?.players?.length || 0) > 0 || (highPriority?.length || 0) > 0;
  const pending = lab.secondaryLoading && !hasSeededBoard;

  return (
    <div className="rh-cc-page fc-lab-cc-page" data-testid="fc-lab-page-desktop">
      <section id={FUTURECAST_LAB_ANCHORS.overview}>
        <FutureCastHero
          summary={data.summary}
          metrics={data.metrics}
          heatLevel={data.heatLevel}
          masterBoard={data.masterBoard}
          movementIntel={data.movementIntel}
          highPriority={highPriority}
          lastUpdated={data.lastUpdated}
        />
      </section>

      <div className="fc-lab-desktop-board rh-frame">
        <div className="fc-lab-desktop-board__lead" id={FUTURECAST_LAB_ANCHORS.masterBoard}>
          <div id={FUTURECAST_LAB_ANCHORS.trending}>
            {pending ? (
              <PanelSkeleton minHeight={320} />
            ) : (
              <FutureCastTargetsPanel
                masterBoard={data.masterBoard}
                trendingBoard={data.trendingBoard}
                highPriority={highPriority}
                battlesCompact
              />
            )}
            {pending ? null : <FutureCastFlipWatchPanel flipWatch={data.flipWatch} />}
          </div>
        </div>

        <div className="fc-lab-desktop-board__fit" id={FUTURECAST_LAB_ANCHORS.positions}>
          {pending ? (
            <PanelSkeleton minHeight={320} />
          ) : (
            <FutureCastPositionBreakdown
              players={data.masterBoard.players}
              highPriority={highPriority}
              underclassmen={data.underclassmen}
              roster={data.roster}
              commits2027={data.commits2027}
              updatedAt={data.lastUpdated}
            />
          )}
          <div id={FUTURECAST_LAB_ANCHORS.portal}>
            {pending ? null : (
              <FutureCastPortalCrossView
                portalPlayers={data.home.portalWatchlist ?? []}
                masterBoard={data.masterBoard}
                portalSeason={data.home.portalSeason}
              />
            )}
          </div>
        </div>
      </div>

      <section id={FUTURECAST_LAB_ANCHORS.movement} className="rh-frame">
        {pending ? null : (
          <FutureCastMovementPanel
            movementIntel={data.movementIntel}
            highPriority={highPriority}
            underclassmen={data.underclassmen}
          />
        )}
      </section>

      <section id="fc-lab-extended" className="fc-lab-extended-full rh-frame">
        {pending ? (
          <PanelSkeleton minHeight={320} />
        ) : (
          <FutureCastExtendedModules
            masterBoard={data.masterBoard}
            trendingBoard={data.trendingBoard}
            movementIntel={data.movementIntel}
            highPriority={highPriority}
            visitIntel={data.visitIntel}
            visitRecap={data.visitRecap}
            flipWatch={data.flipWatch}
            movementNarratives={data.movementNarratives}
            staffNotes={data.staffNotes}
            underclassmen={data.underclassmen}
            roster={data.roster}
            commits2027={data.commits2027}
          />
        )}
      </section>

      <section id={FUTURECAST_LAB_ANCHORS.feed}>
        {pending ? (
          <PanelSkeleton minHeight={180} />
        ) : (
          <FutureCastLiveFeed
            masterBoard={data.masterBoard}
            staffNotes={data.staffNotes}
            movementIntel={data.movementIntel}
            highPriority={highPriority}
            underclassmen={data.underclassmen}
          />
        )}
      </section>
    </div>
  );
}
