'use client';

import React, { useMemo } from 'react';
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

function NeedRow({
  row,
  boardClassYear,
}: {
  row: PositionNeedRow;
  boardClassYear: number;
}): React.ReactElement {
  return (
    <article
      className={`fc-lab-need-row fc-lab-need-row--${row.needTier}`}
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
          {boardClassYear} board · {boardStrengthLabel(row.boardStrength)}
          {row.avgUfPct != null ? ` · ${row.avgUfPct}% avg` : ''}
        </span>
      </header>

      <p className="fc-lab-need-row__reason">{row.reason}</p>

      <div className="fc-lab-need-stats" aria-label={`${row.position} depth stats`}>
        <div className="fc-lab-need-stat">
          <span className="fc-lab-need-stat__label">Roster</span>
          <strong className="fc-lab-need-stat__value">{row.rosterCount}</strong>
        </div>
        <div className="fc-lab-need-stat">
          <span className="fc-lab-need-stat__label">Leaving ≤1 yr</span>
          <strong className="fc-lab-need-stat__value">{row.departingSoon}</strong>
        </div>
        <div className="fc-lab-need-stat">
          <span className="fc-lab-need-stat__label">2027 commits</span>
          <strong className="fc-lab-need-stat__value">{row.commits2027}</strong>
        </div>
        <div className="fc-lab-need-stat">
          <span className="fc-lab-need-stat__label">Projected</span>
          <strong className="fc-lab-need-stat__value">
            {row.projectedDepth}
            <span className="fc-lab-need-stat__floor"> / {row.schemeMin}</span>
          </strong>
        </div>
        <div className="fc-lab-need-stat">
          <span className="fc-lab-need-stat__label">{boardClassYear} targets</span>
          <strong className="fc-lab-need-stat__value">{row.boardTargets}</strong>
        </div>
        <div className="fc-lab-need-stat">
          <span className="fc-lab-need-stat__label">Battles</span>
          <strong className="fc-lab-need-stat__value">{row.battles}</strong>
        </div>
      </div>

      {(row.departing.length > 0 || row.commits.length > 0 || row.topTargets.length > 0) && (
        <div className="fc-lab-need-lists">
          {row.departing.length > 0 ? (
            <div className="fc-lab-need-list">
              <span className="fc-lab-need-list__label">Likely departing</span>
              <ul>
                {row.departing.map((p) => (
                  <li key={`dep-${row.position}-${p.slug || p.name}`}>
                    {p.slug ? (
                      <a href={playerProfileRoute(p.slug, 'roster')}>{p.name}</a>
                    ) : (
                      p.name
                    )}
                    {p.detail ? <span> · {p.detail}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {row.commits.length > 0 ? (
            <div className="fc-lab-need-list">
              <span className="fc-lab-need-list__label">2027 commits</span>
              <ul>
                {row.commits.map((p) => (
                  <li key={`cmt-${row.position}-${p.slug || p.name}`}>
                    {p.slug ? (
                      <a href={playerProfileRoute(p.slug, 'futurecast')}>{p.name}</a>
                    ) : (
                      p.name
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {row.topTargets.length > 0 ? (
            <div className="fc-lab-need-list">
              <span className="fc-lab-need-list__label">{boardClassYear} board leaders</span>
              <ul>
                {row.topTargets.map((p) => (
                  <li key={`tgt-${row.position}-${p.slug || p.name}`}>
                    {p.slug ? (
                      <a href={playerProfileRoute(p.slug, 'futurecast')}>{p.name}</a>
                    ) : (
                      p.name
                    )}
                    {p.detail ? <span> · {p.detail}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
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

  const title = 'How the board fits Florida';
  const sub = discoveryFocus
    ? `${boardClassYear} rooms ranked by roster need — plus who fits the scheme.`
    : `${boardClassYear} rooms ranked by roster need, then how the board stacks at each spot.`;

  return (
    <FutureCastPanelShell bare={bare} title={title} sub={sub} testId="fc-lab-position-breakdown">
      <p className="fc-lab-need-meta">
        <span className={`fc-lab-need-confidence fc-lab-need-confidence--${board.confidence}`}>
          {board.confidence === 'high' ? 'Auto-updating' : 'Loading inputs'}
        </span>
        <span className="fc-lab-need-meta__note">{board.confidenceNote}</span>
      </p>

      {board.rows.length === 0 ? (
        <p className="rh-cc-empty">Need board unavailable until roster and commit feeds load.</p>
      ) : (
        <div className="fc-lab-need-list-wrap">
          {board.rows.map((row) => (
            <NeedRow key={row.position} row={row} boardClassYear={board.boardClassYear} />
          ))}
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

      <p className="fc-lab-need-foot">{board.methodNote}</p>
    </FutureCastPanelShell>
  );
}
