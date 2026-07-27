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
  if (strength === 'lean-uf') return 'Florida leading';
  if (strength === 'battle') return 'Open battles';
  if (strength === 'behind') return 'Florida trailing';
  return 'No targets yet';
}

function NeedRowElite({ row }: { row: PositionNeedRow }): React.ReactElement {
  const lead = row.topTargets[0];
  const ufPct = row.avgUfPct != null ? Math.max(0, Math.min(100, row.avgUfPct)) : 0;
  const fieldPct = 100 - ufPct;
  const leadOdds = lead?.detail ? String(lead.detail) : null;

  return (
    <article
      className={`fc-lab-need-row fc-lab-need-row--elite fc-lab-need-row--${row.needTier}`}
      data-testid="fc-lab-need-row"
    >
      <header className="fc-lab-need-elite__head">
        <div className="fc-lab-need-elite__pos-wrap">
          <span className="fc-lab-need-elite__rank">#{row.needRank}</span>
          <strong className="fc-lab-need-elite__pos">{row.position}</strong>
          <span className={`fc-lab-need-tier fc-lab-need-tier--${row.needTier}`}>
            {needTierLabel(row.needTier)}
          </span>
        </div>
        <span className={`fc-lab-need-elite__status fc-lab-need-strength--${row.boardStrength}`}>
          {boardStrengthPlain(row.boardStrength)}
        </span>
      </header>

      <div className="fc-lab-need-elite__meter" aria-label={`Florida room odds ${ufPct}%`}>
        <div className="fc-lab-need-elite__meter-track">
          <span className="fc-lab-need-elite__meter-uf" style={{ width: `${ufPct}%` }} />
          <span className="fc-lab-need-elite__meter-field" style={{ width: `${fieldPct}%` }} />
        </div>
        <div className="fc-lab-need-elite__meter-labels">
          <span>UF {ufPct}%</span>
          <span>Field {fieldPct}%</span>
        </div>
      </div>

      {lead ? (
        <p className="fc-lab-need-elite__lead">
          {lead.slug ? (
            <a href={playerProfileRoute(lead.slug, 'futurecast')}>{lead.name}</a>
          ) : (
            <strong>{lead.name}</strong>
          )}
          {leadOdds ? <span className="fc-lab-need-elite__lead-odds">{leadOdds}</span> : null}
        </p>
      ) : (
        <p className="fc-lab-need-elite__lead fc-lab-need-elite__lead--empty">No board leader yet</p>
      )}

      {row.reason ? <p className="fc-lab-need-elite__note">{row.reason}</p> : null}
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
    ? `${boardClassYear} rooms — need, UF vs field, top name.`
    : `${boardClassYear} rooms — need, UF vs field, top name.`;

  return (
    <FutureCastPanelShell bare={bare} title={title} sub={sub} testId="fc-lab-position-breakdown">
      {board.rows.length === 0 ? (
        <p className="rh-cc-empty">Need board unavailable until roster and commit feeds load.</p>
      ) : (
        <div className="fc-lab-need-list-wrap">
          {visible.map((row) => (
            <NeedRowElite key={row.position} row={row} />
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
