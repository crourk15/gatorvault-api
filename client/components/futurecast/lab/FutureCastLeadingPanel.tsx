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
  isNextCommitPick,
  nextCommitScore,
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

function RivalCell({ player }: { player: FcLabTarget }): React.ReactElement {
  const threat = topThreatVsFlorida(player);
  const margin = Math.round(floridaLeadMargin(player));
  if (!threat) {
    return <span className="fc-lab-lead-row__rival-empty">Board lead</span>;
  }
  const logo = schoolLogoUrl(threat.name);
  const initials = schoolLogoInitials(threat.name) || threat.label;
  return (
    <span className="fc-lab-lead-row__rival" aria-label={`Leads ${threat.label} by ${Math.max(margin, 1)}`}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="fc-lab-lead-row__rival-logo" src={logo} alt="" width={22} height={22} loading="lazy" decoding="async" />
      ) : (
        <span className="fc-lab-lead-row__rival-fallback" aria-hidden>
          {initials}
        </span>
      )}
      <span className="fc-lab-lead-row__margin">+{Math.max(margin, 1)}</span>
    </span>
  );
}

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
  const tone = delta > 0 ? 'rise' : delta < 0 ? 'fall' : 'flat';

  return (
    <a
      href={playerProfileRoute(player.slug, 'futurecast')}
      className={`fc-lab-lead-row${nextPick ? ' fc-lab-lead-row--next' : ''}`}
      data-testid={nextPick ? 'fc-lab-lead-row-next' : 'fc-lab-lead-row-lead'}
    >
      <span className="fc-lab-lead-row__rank" aria-hidden>
        {rank}
      </span>
      <div className="fc-lab-lead-row__identity">
        <span className="fc-lab-lead-row__name">{player.name}</span>
        <span className="fc-lab-lead-row__meta">
          {player.position}
          {player.school ? ` · ${player.school}` : ''}
          {player.stars != null ? ` · ${player.stars}★` : ''}
        </span>
      </div>
      <div className="fc-lab-lead-row__badge-slot">
        {nextPick ? <span className="fc-lab-lead-stamp fc-lab-lead-stamp--next">Next commit</span> : null}
      </div>
      <div className="fc-lab-lead-row__rival-slot">
        <RivalCell player={player} />
      </div>
      <div className="fc-lab-lead-row__right">
        <strong className="fc-lab-lead-row__pct">{pct}%</strong>
        {showMovement && delta !== 0 ? <MovementBadge delta={delta} tone={tone} /> : null}
      </div>
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
 * Fan scoreboard: Florida lead board with GV Next Commit picks called out.
 * Separate from Priority chase and Share climate.
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

  const leaders = useMemo(
    () => pool.filter(isFloridaLeadingOnBoard).sort(sortByNextCommit).slice(0, 10),
    [pool]
  );

  const showMovement = useMemo(() => movementDeltasAreBelievable(leaders), [leaders]);

  if (!leaders.length) return null;

  const nextCount = leaders.filter((p) => isNextCommitPick(p)).length;
  const title = discoveryView ? `${focusYear} Next commits` : 'Next commits';
  const sub =
    nextCount > 0
      ? 'GatorVault read on who Florida is ahead on — Next commit marks the closest flips.'
      : 'GatorVault read on who Florida is ahead on right now.';

  return (
    <FutureCastPanelShell bare={bare} title={title} sub={sub} testId="fc-lab-leading">
      <div className="fc-lab-lead-board" data-testid="fc-lab-next-commits">
        <div className="fc-lab-lead-list__cols" aria-hidden="true">
          <span>#</span>
          <span>Name</span>
          <span>GV call</span>
          <span>Lead vs</span>
          <span>UF %</span>
        </div>
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
