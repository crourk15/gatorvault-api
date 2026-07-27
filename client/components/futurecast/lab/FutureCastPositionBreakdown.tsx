'use client';

import React, { useMemo, useState } from 'react';
import type { FutureCastPlayer } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { RosterPlayer } from '@/lib/roster-api';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { playerProfileRoute } from '@/lib/vault-route-map';
import {
  buildPositionNeedBoard,
  needTierLabel,
  type PositionNeedRow,
} from '@/lib/fc-position-need-board';
import { buildSchemeMatchLeaders } from '@/lib/scheme-match-leaders';
import { FutureCastPanelShell } from './primitives';
import { useFutureCastLabCycle } from './FutureCastLabCycleContext';

type Props = {
  players: FutureCastPlayer[];
  highPriority?: HighPriorityPlayer[];
  roster?: RosterPlayer[];
  commits2027?: RecruitingBoardPlayer[];
  updatedAt?: string | null;
  bare?: boolean;
};

function boardStrengthPlain(strength: PositionNeedRow['boardStrength']): string {
  if (strength === 'lean-uf') return 'Florida is winning this room';
  if (strength === 'battle') return 'Open battles for Florida';
  if (strength === 'behind') return 'Florida trailing in this room';
  return 'No active Florida targets yet';
}

function NeedRowCompact({
  row,
  boardClassYear,
}: {
  row: PositionNeedRow;
  boardClassYear: number;
}): React.ReactElement {
  const lead = row.topTargets[0];

  return (
    <article
      className={`fc-lab-need-row fc-lab-need-row--compact fc-lab-need-row--${row.needTier}`}
      data-testid="fc-lab-need-row"
    >
      <header className="fc-lab-need-row__head">
        <div className="fc-lab-need-row__rank-wrap">
          <span className="fc-lab-need-row__rank">#{row.needRank}</span>
          <strong className="fc-lab-need-row__pos">{row.position}</strong>
          <span className={`fc-lab-need-tier fc-lab-need-tier--${row.needTier}`}>
            {needTierLabel(row.needTier)}
          </span>
        </div>
      </header>
      <p className={`fc-lab-need-plain fc-lab-need-strength--${row.boardStrength}`}>
        {boardStrengthPlain(row.boardStrength)}
        {row.avgUfPct != null ? (
          <span className="fc-lab-need-plain__odds"> · avg Florida odds {row.avgUfPct}%</span>
        ) : null}
        <span className="fc-lab-need-plain__year"> · {boardClassYear} board</span>
      </p>
      {row.reason ? <p className="fc-lab-need-row__reason">{row.reason}</p> : null}
      {lead ? (
        <p className="fc-lab-need-row__lead">
          <span className="fc-lab-need-row__lead-label">Top target: </span>
          {lead.slug ? (
            <a href={playerProfileRoute(lead.slug, 'futurecast')}>{lead.name}</a>
          ) : (
            lead.name
          )}
          {lead.detail ? <span> · {lead.detail}</span> : null}
        </p>
      ) : (
        <p className="fc-lab-need-row__lead fc-lab-need-row__lead--empty">No active board leader yet</p>
      )}
    </article>
  );
}

export function FutureCastPositionBreakdown({
  players,
  highPriority = [],
  roster = [],
  commits2027 = [],
  updatedAt,
  bare,
}: Props): React.ReactElement {
  const { discoveryView: discoveryFocus } = useFutureCastLabCycle();
  const boardClassYear = discoveryFocus ? 2028 : 2027;
  const [showAll, setShowAll] = useState(false);

  const board = useMemo(() => {
    const boardPlayers =
      discoveryFocus && highPriority.length ? highPriority : players;
    return buildPositionNeedBoard({
      roster,
      commits2027,
      boardPlayers,
      boardClassYear,
      commitClassYear: 2027,
      updatedAt,
    });
  }, [discoveryFocus, highPriority, players, roster, commits2027, boardClassYear, updatedAt]);

  const schemeMatches = useMemo(() => {
    if (!discoveryFocus || !highPriority.length) return [];
    const needTierByPos: Record<string, (typeof board.rows)[number]['needTier']> = {};
    for (const row of board.rows) needTierByPos[row.position] = row.needTier;
    return buildSchemeMatchLeaders(highPriority, needTierByPos, 3);
  }, [discoveryFocus, highPriority, board.rows]);

  const featured = useMemo(() => {
    const priority = board.rows.filter((r) => r.needTier === 'critical' || r.needTier === 'high');
    if (priority.length >= 3) return priority.slice(0, 3);
    return board.rows.slice(0, 3);
  }, [board.rows]);

  const hiddenCount = Math.max(0, board.rows.length - featured.length);
  const visible = showAll ? board.rows : featured;

  const title = 'How the board fits Florida';
  const sub = discoveryFocus
    ? `Where Florida needs help in ${boardClassYear} — and who’s the top name in each room.`
    : `Where Florida needs help on the ${boardClassYear} board.`;

  return (
    <FutureCastPanelShell bare={bare} title={title} sub={sub} testId="fc-lab-position-breakdown">
      {board.rows.length === 0 ? (
        <p className="rh-cc-empty">Need board unavailable until roster and commit feeds load.</p>
      ) : (
        <div className="fc-lab-need-list-wrap">
          {visible.map((row) => (
            <NeedRowCompact key={row.position} row={row} boardClassYear={board.boardClassYear} />
          ))}
          {hiddenCount > 0 ? (
            <button
              type="button"
              className="fc-lab-need-more"
              onClick={() => setShowAll((v) => !v)}
              data-testid="fc-lab-need-more"
            >
              {showAll ? 'Show top needs only' : `All rooms → (${hiddenCount} more)`}
            </button>
          ) : null}
        </div>
      )}

      {schemeMatches.length > 0 ? (
        <div className="fc-lab-scheme-inline" data-testid="fc-lab-scheme-matches">
          <h3 className="fc-lab-scheme-inline__title">Best scheme matches</h3>
          <ul className="fc-lab-scheme-match-list">
            {schemeMatches.map((row) => (
              <li key={row.slug} className="fc-lab-scheme-match">
                <a href={playerProfileRoute(row.slug, 'futurecast')} className="fc-lab-scheme-match__link">
                  <div className="fc-lab-scheme-match__head">
                    <strong className="fc-lab-scheme-match__name">{row.name}</strong>
                    <span className={`fc-lab-scheme-match__band fc-lab-scheme-match__band--${row.fitBand}`}>
                      {row.fitLabel}
                    </span>
                  </div>
                  <p className="fc-lab-scheme-match__meta">
                    {row.position}
                    {row.why ? ` · ${row.why}` : ''}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </FutureCastPanelShell>
  );
}
