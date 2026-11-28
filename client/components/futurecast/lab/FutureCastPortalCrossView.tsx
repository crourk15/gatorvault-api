'use client';

import React from 'react';
import type { MasterBoardResponse } from '@/lib/futurecast-board-types';
import type { PortalWatchlistHomePlayer } from '@/lib/futurecast-home-api';
import type { PortalSeasonState } from '@/lib/recruiting-cycle';
import { portalDormantMessage, resolvePortalSeason } from '@/lib/recruiting-cycle';
import { FUTURECAST_LAB_ANCHORS, futureCastLabHref } from '@/lib/vault-route-map';
import { PortalList } from '@/components/vault/recruiting/RecruitingPortalSection';

type Props = {
  portalPlayers: PortalWatchlistHomePlayer[];
  masterBoard: MasterBoardResponse;
  portalSeason?: PortalSeasonState | null;
  bare?: boolean;
};

/** FutureCast Portal Room — roster holes, then only verified gap-fillers. */
export function FutureCastPortalCrossView(_props: Props): React.ReactElement {
  return <PortalList />;
}

type DormantProps = {
  portalSeason?: PortalSeasonState | null;
  className?: string;
  testId?: string;
};

export function PortalSeasonDormantCard({
  portalSeason,
  className = 'rh-cc-empty fc-portal-dormant',
  testId = 'fc-portal-dormant',
}: DormantProps): React.ReactElement {
  const state = resolvePortalSeason(portalSeason, 0);
  return (
    <div className={className} data-testid={testId} data-portal-phase={state.phase}>
      <p className="fc-portal-dormant__title">Football portal opens January 4, 2027</p>
      <p className="fc-portal-dormant__text">
        {portalDormantMessage(state)}. 10–12 difference makers — not 30 practice bodies. Names
        land when they fill a roster hole.
      </p>
      {state.nextWindowStart ? (
        <p className="fc-portal-dormant__meta">Window {state.nextWindowStart} through January 13.</p>
      ) : null}
      <a href={futureCastLabHref(FUTURECAST_LAB_ANCHORS.portal)} className="fc-card-link">
        Open Portal Room →
      </a>
    </div>
  );
}
