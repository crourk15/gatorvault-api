'use client';

import React, { useMemo } from 'react';
import type { MasterBoardResponse, TrendingBoardResponse } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { FutureCastPanelShell, MovementBadge } from './primitives';
import {
  futureCastPlayerToLabTarget,
  highPriorityToLabTarget,
  movementDeltasAreBelievable,
  ufPctFromFc,
  type FcLabTarget,
} from './fc-lab-types';
import { useFutureCastLabCycle } from './FutureCastLabCycleContext';
import {
  floridaLeadMargin,
  isFloridaLeadingOnBoard,
  isLikelyNextCommit,
  topThreatVsFlorida,
} from './competing-schools';
import { isActiveUfTarget } from '@/lib/recruiting-target-filters';
import { schoolLogoInitials, schoolLogoUrl } from '@/lib/school-logos';

type Props = {
  masterBoard: MasterBoardResponse;
  trendingBoard?: TrendingBoardResponse;
  highPriority?: HighPriorityPlayer[];
  bare?: boolean;
};

function LeadRow({
  player,
  showMovement,
  stamp,
}: {
  player: FcLabTarget;
  showMovement: boolean;
  stamp: 'next' | 'lead';
}): React.ReactElement {
  const pct = ufPctFromFc(player.ufProbability);
  const delta = showMovement ? Math.round(player.delta7d ?? 0) : 0;
  const tone = delta > 0 ? 'rise' : delta < 0 ? 'fall' : 'flat';
  const threat = topThreatVsFlorida(player);
  const margin = Math.round(floridaLeadMargin(player));

  return (
    <a
      href={playerProfileRoute(player.slug, 'futurecast')}
      className={`fc-lab-lead-row fc-lab-lead-row--${stamp}`}
      data-testid={`fc-lab-lead-row-${stamp}`}
    >
      <div className="fc-lab-lead-row__identity">
        <span className="fc-lab-lead-row__name">{player.name}</span>
        <span className="fc-lab-lead-row__meta">
          {player.position}
          {player.school ? ` · ${player.school}` : ''}
          {player.stars != null ? ` · ${player.stars}★` : ''}
        </span>
      </div>
      <span className={`fc-lab-lead-stamp fc-lab-lead-stamp--${stamp}`}>
        {stamp === 'next' ? 'Likely next' : 'Leading'}
      </span>
      <span className="fc-lab-lead-row__rival" aria-label={threat ? `Leads ${threat.label}` : 'Board lead'}>
        {threat ? (
          <>
            {(() => {
              const logo = schoolLogoUrl(threat.name);
              const initials = schoolLogoInitials(threat.name) || threat.label;
              return logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="fc-lab-lead-row__rival-logo"
                  src={logo}
                  alt=""
                  width={22}
                  height={22}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="fc-lab-lead-row__rival-fallback" aria-hidden>
                  {initials}
                </span>
              );
            })()}
            <span className="fc-lab-lead-row__margin">+{Math.max(margin, 1)}</span>
          </>
        ) : (
          <span className="fc-lab-lead-row__margin fc-lab-lead-row__margin--solo">Lead</span>
        )}
      </span>
      <div className="fc-lab-lead-row__right">
        <strong className="fc-lab-lead-row__pct">{pct}%</strong>
        {showMovement && delta !== 0 ? <MovementBadge delta={delta} tone={tone} /> : null}
      </div>
    </a>
  );
}

function sortLeaders(a: FcLabTarget, b: FcLabTarget): number {
  const uf = ufPctFromFc(b.ufProbability) - ufPctFromFc(a.ufProbability);
  if (uf !== 0) return uf;
  const margin = floridaLeadMargin(b) - floridaLeadMargin(a);
  if (margin !== 0) return margin;
  return (b.delta7d ?? 0) - (a.delta7d ?? 0);
}

/**
 * Fan-facing scoreboard: who Florida is ahead on / who looks next to commit.
 * Separate from chase priority (Targets) and share-climate tabs (Battles).
 */
export function FutureCastLeadingPanel({
  masterBoard,
  trendingBoard,
  highPriority = [],
  bare,
}: Props): React.ReactElement | null {
  const { discoveryView } = useFutureCastLabCycle();
  const focusYear = discoveryView ? 2028 : 2027;

  const pool = useMemo(() => {
    const fromHp = highPriority
      .filter((p) => isActiveUfTarget(p))
      .filter((p) => Number(p.classYear) === focusYear)
      .map(highPriorityToLabTarget);

    if (fromHp.length) return fromHp;

    const merged = [
      ...masterBoard.players,
      ...(trendingBoard?.trendingUp ?? []),
      ...(trendingBoard?.trendingDown ?? []),
    ];
    const seen = new Set<string>();
    return merged
      .filter((p) => {
        if (!isActiveUfTarget(p)) return false;
        if (seen.has(p.slug)) return false;
        seen.add(p.slug);
        return Number(p.classYear) === focusYear || !discoveryView;
      })
      .map(futureCastPlayerToLabTarget);
  }, [discoveryView, focusYear, highPriority, masterBoard.players, trendingBoard]);

  const { likelyNext, leadingRest } = useMemo(() => {
    const leaders = pool.filter(isFloridaLeadingOnBoard).sort(sortLeaders);
    const next = leaders.filter((p) => isLikelyNextCommit(p)).slice(0, 6);
    const nextSlugs = new Set(next.map((p) => p.slug));
    const rest = leaders.filter((p) => !nextSlugs.has(p.slug)).slice(0, 8);
    return { likelyNext: next, leadingRest: rest };
  }, [pool]);

  const showMovement = useMemo(
    () => movementDeltasAreBelievable([...likelyNext, ...leadingRest]),
    [likelyNext, leadingRest]
  );

  if (!likelyNext.length && !leadingRest.length) return null;

  const title = discoveryView ? `${focusYear} Leading now` : 'Leading now';
  const sub = discoveryView
    ? 'Who Florida is ahead on — separate from the priority chase below.'
    : 'Who Florida is ahead on right now — closers first, then the rest of the lead board.';

  return (
    <FutureCastPanelShell bare={bare} title={title} sub={sub} testId="fc-lab-leading">
      {likelyNext.length ? (
        <div className="fc-lab-lead-block" data-testid="fc-lab-likely-next">
          <div className="fc-lab-lead-block__head">
            <h3 className="fc-lab-lead-block__title">Likely next</h3>
            <p className="fc-lab-lead-block__sub">Leading the field at 60%+ Florida share</p>
          </div>
          <div className="fc-lab-lead-list">
            {likelyNext.map((p) => (
              <LeadRow key={p.slug} player={p} showMovement={showMovement} stamp="next" />
            ))}
          </div>
        </div>
      ) : null}

      {leadingRest.length ? (
        <div className="fc-lab-lead-block" data-testid="fc-lab-leading-rest">
          <div className="fc-lab-lead-block__head">
            <h3 className="fc-lab-lead-block__title">Also leading</h3>
            <p className="fc-lab-lead-block__sub">
              Ahead of the field even when the share is still splitting
            </p>
          </div>
          <div className="fc-lab-lead-list">
            {leadingRest.map((p) => (
              <LeadRow key={p.slug} player={p} showMovement={showMovement} stamp="lead" />
            ))}
          </div>
        </div>
      ) : null}
    </FutureCastPanelShell>
  );
}
