'use client';

import React, { useMemo } from 'react';
import type { MasterBoardResponse, TrendingBoardResponse } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { UnderclassmenPlayer } from '@/lib/futurecast-underclassmen-api';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { FutureCastPanelShell } from './primitives';
import {
  buildDiscoveryLeadingPool,
  futureCastPlayerToLabTarget,
  highPriorityToLabTarget,
  movementDeltasAreBelievable,
  ufPctFromFc,
  type FcLabTarget,
} from './fc-lab-types';
import { useFutureCastLabCycle } from './FutureCastLabCycleContext';
import {
  credibleThreatVsFlorida,
  floridaLeadMargin,
  hasClosestCommitProcessEvidence,
  hasCredibleBoardLead,
  isFloridaLeadingOnBoard,
  isNextCommitPick,
  nextCommitScore,
} from './competing-schools';
import { isActiveUfTarget } from '@/lib/recruiting-target-filters';
import { schoolLogoInitials, schoolLogoUrl } from '@/lib/school-logos';

type Props = {
  masterBoard: MasterBoardResponse;
  trendingBoard?: TrendingBoardResponse;
  highPriority?: HighPriorityPlayer[];
  /** Full 2028 allowlist board — Closest to commit must not be chase-hot top-18 only. */
  underclassmen?: UnderclassmenPlayer[];
  bare?: boolean;
};

function LeadRow({
  player,
  showMovement,
  nextPick,
  rank,
}: {
  player: FcLabTarget;
  showMovement: boolean;
  nextPick: boolean;
  rank: number;
}): React.ReactElement {
  const pct = ufPctFromFc(player.ufProbability);
  const delta = showMovement ? Math.round(player.delta7d ?? 0) : 0;
  // Thin legacy crumbs (e.g. GT 4.8%) must not read as "Leads GT by 61".
  const threat = credibleThreatVsFlorida(player);
  const margin = threat ? Math.max(1, Math.round(floridaLeadMargin(player))) : 0;
  const rivalLabel = threat?.label || threat?.name || null;
  const logo = threat ? schoolLogoUrl(threat.name) : null;
  const initials = threat ? schoolLogoInitials(threat.name) || threat.label : '';

  const leadLine = rivalLabel
    ? `Leads ${rivalLabel} by ${margin}`
    : 'Florida leads this board';
  const oddsLine =
    delta !== 0
      ? `Florida odds ${pct}% · ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)} this week`
      : `Florida odds ${pct}%`;

  return (
    <a
      href={playerProfileRoute(player.slug, 'futurecast')}
      className={`fc-lab-lead-card${nextPick ? ' fc-lab-lead-card--next' : ''}`}
      data-testid={nextPick ? 'fc-lab-lead-row-next' : 'fc-lab-lead-row-lead'}
    >
      <div className="fc-lab-lead-card__top">
        <span className="fc-lab-lead-card__rank" aria-hidden>
          #{rank}
        </span>
        <div className="fc-lab-lead-card__identity">
          <span className="fc-lab-lead-card__name">{player.name}</span>
          <span className="fc-lab-lead-card__meta">
            {player.position}
            {player.school ? ` · ${player.school}` : ''}
            {player.stars != null ? ` · ${player.stars}★` : ''}
          </span>
        </div>
        {nextPick ? (
          <span className="fc-lab-lead-stamp fc-lab-lead-stamp--next">Closest to commit</span>
        ) : (
          <span className="fc-lab-lead-stamp fc-lab-lead-stamp--lead">Florida ahead</span>
        )}
      </div>

      <div className="fc-lab-lead-card__facts">
        <div className="fc-lab-lead-fact">
          <span className="fc-lab-lead-fact__label">Board lead</span>
          <span className="fc-lab-lead-fact__value">
            {threat ? (
              <>
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="fc-lab-lead-row__rival-logo"
                    src={logo}
                    alt=""
                    width={20}
                    height={20}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="fc-lab-lead-row__rival-fallback" aria-hidden>
                    {initials}
                  </span>
                )}
                <span>{leadLine}</span>
              </>
            ) : (
              <span>{leadLine}</span>
            )}
          </span>
        </div>
        <div className="fc-lab-lead-fact">
          <span className="fc-lab-lead-fact__label">Florida chance</span>
          <span className="fc-lab-lead-fact__value fc-lab-lead-fact__value--strong">{pct}%</span>
        </div>
        <div className="fc-lab-lead-fact">
          <span className="fc-lab-lead-fact__label">7-day move</span>
          <span
            className={`fc-lab-lead-fact__value${
              delta > 0 ? ' is-up' : delta < 0 ? ' is-down' : ''
            }`}
          >
            {delta === 0 ? 'Flat this week' : `${delta > 0 ? 'Up' : 'Down'} ${Math.abs(delta)} pts`}
          </span>
        </div>
      </div>

      <p className="fc-lab-lead-card__summary">{oddsLine}</p>
    </a>
  );
}

function sortByNextCommit(a: FcLabTarget, b: FcLabTarget): number {
  const score = nextCommitScore(b) - nextCommitScore(a);
  if (score !== 0) return score;
  const uf = ufPctFromFc(b.ufProbability) - ufPctFromFc(a.ufProbability);
  if (uf !== 0) return uf;
  return floridaLeadMargin(b) - floridaLeadMargin(a);
}

/**
 * Fan scoreboard: who Florida is ahead on, with closest commit picks called out.
 */
export function FutureCastLeadingPanel({
  masterBoard,
  trendingBoard,
  highPriority = [],
  underclassmen = [],
  bare,
}: Props): React.ReactElement | null {
  const { discoveryView } = useFutureCastLabCycle();
  const focusYear = discoveryView ? 2028 : 2027;

  const pool = useMemo(() => {
    // Discovery: full allowlist year (underclassmen + HP overlay). Chase-hot HP
    // top-18 alone drops board leaders like Hudson West from Closest to commit.
    if (discoveryView) {
      const discoveryPool = buildDiscoveryLeadingPool(
        highPriority,
        underclassmen,
        focusYear,
        isActiveUfTarget
      );
      if (discoveryPool.length) return discoveryPool;
    }

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
        // Closing Class must stay on focusYear — never inherit 2028 Discovery rows.
        return Number(p.classYear) === focusYear;
      })
      .map(futureCastPlayerToLabTarget);
  }, [
    discoveryView,
    focusYear,
    highPriority,
    underclassmen,
    masterBoard.players,
    trendingBoard,
  ]);

  const leaders = useMemo(() => {
    // Discovery: only process-backed Florida leads (offer/visits/intel) — not On3 % alone.
    const eligible = discoveryView
      ? pool.filter(
          (p) =>
            isFloridaLeadingOnBoard(p) &&
            hasCredibleBoardLead(p) &&
            hasClosestCommitProcessEvidence(p)
        )
      : pool.filter(isFloridaLeadingOnBoard);
    return eligible.sort(sortByNextCommit).slice(0, 10);
  }, [discoveryView, pool]);

  const showMovement = useMemo(() => movementDeltasAreBelievable(leaders), [leaders]);

  if (!leaders.length) return null;

  const title = discoveryView ? `${focusYear} Who commits next?` : 'Who commits next?';
  const sub = discoveryView
    ? 'Process-backed only — UF offer, visits, and intel, not On3 percentage alone. Closest stamp means Florida is still in it.'
    : 'Plain-English GatorVault read: who Florida is beating on the board, and who looks closest to flipping.';

  return (
    <FutureCastPanelShell bare={bare} title={title} sub={sub} testId="fc-lab-leading">
      <div className="fc-lab-lead-board" data-testid="fc-lab-next-commits">
        <div className="fc-lab-lead-list">
          {leaders.map((p, i) => (
            <LeadRow
              key={p.slug}
              player={p}
              showMovement={showMovement}
              nextPick={isNextCommitPick(p)}
              rank={i + 1}
            />
          ))}
        </div>
      </div>
    </FutureCastPanelShell>
  );
}
