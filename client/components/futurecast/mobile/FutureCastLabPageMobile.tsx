'use client';

import React from 'react';
import type { FutureCastLabData } from '@/components/futurecast/lab/useFutureCastLabData';
import type { FutureCastPanelSkeleton } from '@/components/futurecast/FutureCastLabSkeleton';
import { FUTURECAST_LAB_ANCHORS } from '@/lib/vault-route-map';
import { useResolvedLabHighPriority } from '@/components/futurecast/lab/FutureCastLabCycleContext';
import { FutureCastHero } from '@/components/futurecast/lab/FutureCastHero';
import { FutureCastTargetsPanel } from '@/components/futurecast/lab/FutureCastTargetsPanel';
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
  const highPriority = useResolvedLabHighPriority(data.highPriority, data.highPriorityClosing);
  // Elite: never blank seeded panels behind secondaryLoading — only skeleton when empty.
  const hasSeededBoard =
    (data.masterBoard?.players?.length || 0) > 0 || (highPriority?.length || 0) > 0;
  const pending = lab.secondaryLoading && !hasSeededBoard;

  return (
    <div className="rh-cc-page fc-lab-cc-page" data-testid="fc-lab-page-mobile">
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

      <div className="rh-cc-main rh-frame">
        <div className="rh-cc-col">
          <section id={FUTURECAST_LAB_ANCHORS.masterBoard}>
            <div id={FUTURECAST_LAB_ANCHORS.trending}>
              {pending ? (
                <PanelSkeleton minHeight={240} />
              ) : (
                <FutureCastTargetsPanel
                  masterBoard={data.masterBoard}
                  trendingBoard={data.trendingBoard}
                  highPriority={highPriority}
                  battlesCompact
                />
              )}
            </div>
          </section>
          <section id={FUTURECAST_LAB_ANCHORS.movement}>
            {pending ? (
              <PanelSkeleton minHeight={260} />
            ) : (
              <FutureCastMovementPanel
                movementIntel={data.movementIntel}
                highPriority={highPriority}
                underclassmen={data.underclassmen}
              />
            )}
          </section>
          <section id={FUTURECAST_LAB_ANCHORS.positions}>
            {pending ? (
              <PanelSkeleton minHeight={300} />
            ) : (
              <FutureCastPositionBreakdown
                players={data.masterBoard.players}
                highPriority={highPriority}
                roster={data.roster}
                commits2027={data.commits2027}
                updatedAt={data.lastUpdated}
              />
            )}
          </section>
          <section id="fc-lab-extended">
            {pending ? (
              <PanelSkeleton minHeight={280} />
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
          <section id={FUTURECAST_LAB_ANCHORS.portal}>
            {pending ? (
              <PanelSkeleton minHeight={180} />
            ) : (
              <FutureCastPortalCrossView
                portalPlayers={data.home.portalWatchlist ?? []}
                masterBoard={data.masterBoard}
                portalSeason={data.home.portalSeason}
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
            highPriority={highPriority}
            underclassmen={data.underclassmen}
          />
        )}
      </section>
    </div>
  );
}
