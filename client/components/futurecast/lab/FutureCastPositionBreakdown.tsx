'use client';

import React, { useMemo, useState } from 'react';
import type { FutureCastPlayer } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { UnderclassmenPlayer } from '@/lib/futurecast-underclassmen-api';
import type { RosterPlayer } from '@/lib/roster-api';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { playerProfileRoute } from '@/lib/vault-route-map';
import {
  buildPositionNeedBoard,
  type PositionNeedRow,
} from '@/lib/fc-position-need-board';
import { buildSchemeMatchLeaders } from '@/lib/scheme-match-leaders';
import { discoveryNeedBoardPlayers } from './fc-lab-types';
import { FutureCastPanelShell } from './primitives';
import { useFutureCastLabCycle } from './FutureCastLabCycleContext';

type Props = {
  players: FutureCastPlayer[];
  highPriority?: HighPriorityPlayer[];
  underclassmen?: UnderclassmenPlayer[];
  roster?: RosterPlayer[];
  commits2027?: RecruitingBoardPlayer[];
  updatedAt?: string | null;
  bare?: boolean;
};

function positionTitle(pos: string): string {
  const map: Record<string, string> = {
    QB: 'Quarterback',
    RB: 'Running back',
    WR: 'Wide receiver',
    TE: 'Tight end',
    OT: 'Offensive tackle',
    IOL: 'Interior line',
    OL: 'Offensive line',
    EDGE: 'Edge',
    DL: 'Defensive line',
    LB: 'Linebacker',
    CB: 'Cornerback',
    S: 'Safety',
    ATH: 'Athlete',
  };
  return map[pos] || pos;
}

function needChip(tier: PositionNeedRow['needTier']): { label: string; tone: string } {
  if (tier === 'critical') return { label: 'Must add', tone: 'critical' };
  if (tier === 'high') return { label: 'Needs help', tone: 'high' };
  if (tier === 'watch') return { label: 'Keep an eye', tone: 'watch' };
  return { label: 'In good shape', tone: 'stable' };
}

function chasePlain(strength: PositionNeedRow['boardStrength'], ufPct: number): string {
  if (strength === 'lean-uf') return 'Florida is ahead here';
  if (strength === 'battle') return 'Still up for grabs';
  if (strength === 'behind') {
    return ufPct <= 15 ? 'Other schools are ahead' : 'Florida is behind right now';
  }
  return 'No clear Florida targets yet';
}

function NeedRowElite({ row }: { row: PositionNeedRow }): React.ReactElement {
  const lead = row.topTargets[0];
  const ufPct = row.avgUfPct != null ? Math.max(0, Math.min(100, row.avgUfPct)) : 0;
  const hasBoard = row.avgUfPct != null;
  const chip = needChip(row.needTier);
  const chase = chasePlain(row.boardStrength, ufPct);
  const leadOddsMatch = lead?.detail ? String(lead.detail).match(/(\d+)\s*%/) : null;
  const leadOdds = leadOddsMatch ? `${leadOddsMatch[1]}% Florida` : null;

  return (
    <article
      className={`fc-lab-need-row fc-lab-need-row--elite fc-lab-need-row--${row.needTier}`}
      data-testid="fc-lab-need-row"
    >
      <header className="fc-lab-need-elite__head">
        <div className="fc-lab-need-elite__pos-wrap">
          <span className="fc-lab-need-elite__rank">#{row.needRank}</span>
          <strong className="fc-lab-need-elite__pos">{positionTitle(row.position)}</strong>
          <span className={`fc-lab-need-tier fc-lab-need-tier--${chip.tone}`}>{chip.label}</span>
        </div>
        <span className={`fc-lab-need-elite__status fc-lab-need-strength--${row.boardStrength}`}>
          {chase}
        </span>
      </header>

      <div
        className="fc-lab-need-elite__meter"
        aria-label={
          hasBoard
            ? `Florida chance in this room ${ufPct} percent`
            : 'Florida chance in this room unavailable'
        }
      >
        <div className="fc-lab-need-elite__meter-head">
          <span className="fc-lab-need-elite__meter-caption">Florida’s chance in this room</span>
          <strong className="fc-lab-need-elite__meter-pct">{hasBoard ? `${ufPct}%` : '—'}</strong>
        </div>
        <div className="fc-lab-need-elite__meter-track">
          <span
            className="fc-lab-need-elite__meter-uf"
            style={{ width: hasBoard ? `${ufPct}%` : '0%' }}
          />
        </div>
      </div>

      {lead ? (
        <p className="fc-lab-need-elite__lead">
          <span className="fc-lab-need-elite__lead-label">Best Florida shot</span>
          {lead.slug ? (
            <a href={playerProfileRoute(lead.slug, 'futurecast')}>{lead.name}</a>
          ) : (
            <strong>{lead.name}</strong>
          )}
          {leadOdds ? <span className="fc-lab-need-elite__lead-odds">{leadOdds}</span> : null}
        </p>
      ) : (
        <p className="fc-lab-need-elite__lead fc-lab-need-elite__lead--empty">
          No clear Florida shot yet
        </p>
      )}

      {row.reason ? <p className="fc-lab-need-elite__note">{row.reason}</p> : null}
    </article>
  );
}

export function FutureCastPositionBreakdown({
  players,
  highPriority = [],
  underclassmen = [],
  roster = [],
  commits2027 = [],
  updatedAt,
  bare,
}: Props): React.ReactElement {
  const { discoveryView: discoveryFocus } = useFutureCastLabCycle();
  const boardClassYear = discoveryFocus ? 2028 : 2027;
  const [showAll, setShowAll] = useState(false);

  const board = useMemo(() => {
    // Discovery: full 2028 target board (underclassmen + HP), not Hottest top-18 only.
    const boardPlayers = discoveryFocus
      ? discoveryNeedBoardPlayers(highPriority, underclassmen, boardClassYear)
      : players;
    return buildPositionNeedBoard({
      roster,
      commits2027,
      boardPlayers: boardPlayers.length ? boardPlayers : players,
      boardClassYear,
      commitClassYear: 2027,
      updatedAt,
    });
  }, [
    discoveryFocus,
    highPriority,
    underclassmen,
    players,
    roster,
    commits2027,
    boardClassYear,
    updatedAt,
  ]);

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

  const title = 'Where Florida needs help';
  const sub = `${boardClassYear} — which rooms need the next commit, and how Florida is doing there.`;

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
              {showAll ? 'Show top needs only' : `See all rooms (${hiddenCount} more)`}
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
