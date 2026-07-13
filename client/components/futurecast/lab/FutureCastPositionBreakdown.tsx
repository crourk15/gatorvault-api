'use client';

import React, { useMemo, useState } from 'react';
import type { FutureCastPlayer } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { RosterPlayer } from '@/lib/roster-api';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { playerProfileRoute } from '@/lib/vault-route-map';
import {
  boardStrengthLabel,
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

function NeedRowCompact({
  row,
  boardClassYear,
}: {
  row: PositionNeedRow;
  boardClassYear: number;
}): React.ReactElement {
  const lead = row.topTargets[0];
  const reasonShort = row.reason.split(' · ').slice(0, 2).join(' · ');

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
        <span className={`fc-lab-need-strength fc-lab-need-strength--${row.boardStrength}`}>
          {boardClassYear} · {boardStrengthLabel(row.boardStrength)}
          {row.avgUfPct != null ? ` · ${row.avgUfPct}%` : ''}
        </span>
      </header>
      <p className="fc-lab-need-row__reason">{reasonShort}</p>
      {lead ? (
        <p className="fc-lab-need-row__lead">
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
    return buildSchemeMatchLeaders(highPriority, needTierByPos, 5);
  }, [discoveryFocus, highPriority, board.rows]);

  const featured = useMemo(() => {
    const priority = board.rows.filter((r) => r.needTier === 'critical' || r.needTier === 'high');
    if (priority.length >= 3) return priority.slice(0, 4);
    return board.rows.slice(0, 3);
  }, [board.rows]);

  const hiddenCount = Math.max(0, board.rows.length - featured.length);
  const visible = showAll ? board.rows : featured;

  const title = 'How the board fits Florida';
  const sub = discoveryFocus
    ? `Top ${boardClassYear} needs — plus who fits the scheme.`
    : `Top ${boardClassYear} needs, then how the board stacks.`;

  return (
    <FutureCastPanelShell bare={bare} title={title} sub={sub} testId="fc-lab-position-breakdown">
      <p className="fc-lab-need-meta">
        <span className={`fc-lab-need-confidence fc-lab-need-confidence--${board.confidence}`}>
          {board.confidence === 'high' ? 'Live roster' : 'Loading inputs'}
        </span>
        <span className="fc-lab-need-meta__note">{board.confidenceNote}</span>
      </p>

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
          <p className="fc-lab-scheme-inline__sub">Who fits what Florida needs — not who ranks highest.</p>
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
                    {row.school ? ` · ${row.school}` : ''}
                  </p>
                  <p className="fc-lab-scheme-match__why">{row.why}</p>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </FutureCastPanelShell>
  );
}
