/**
 * On3 RPM / competing-school intel for player profile overview.
 * Ranked logo + % rows (no multi-bar meters).
 */
import React from 'react';
import type { FullProfileCompetingSchool, FullProfileFuturecastSummary } from '@/lib/player-full-profile-api';
import { SchoolRankRow } from './SchoolRankRow';

export interface BoardIntelPanelProps {
  ufProbability: number | null;
  competingSchools: FullProfileCompetingSchool[];
  futurecastSummary?: FullProfileFuturecastSummary | null;
  staffNote?: string | null;
}

type BoardRow = { school: string; pct: number };

function buildBoardRows(
  ufProbability: number | null,
  competingSchools: FullProfileCompetingSchool[]
): BoardRow[] {
  const rows: BoardRow[] = [];
  if (ufProbability != null && ufProbability > 0) {
    rows.push({ school: 'Florida', pct: ufProbability });
  }
  for (const c of competingSchools) {
    const pct = c.pct != null && c.pct > 0 ? c.pct : null;
    if (pct == null) continue;
    rows.push({ school: c.school, pct });
  }
  return rows.sort((a, b) => b.pct - a.pct);
}

export function BoardIntelPanel({
  ufProbability,
  competingSchools,
  futurecastSummary,
  staffNote,
}: BoardIntelPanelProps): React.ReactElement | null {
  const ufPct = ufProbability ?? futurecastSummary?.ufProbability ?? null;
  const hasBoard = (ufPct != null && ufPct > 0) || competingSchools.some((c) => (c.pct ?? 0) > 0);
  const note = String(staffNote || '').trim();

  if (!hasBoard && !note) return null;

  const rows = hasBoard ? buildBoardRows(ufPct, competingSchools).slice(0, 6) : [];
  const leader = rows[0];

  return (
    <section className="fc-profile-section fc-board-intel" data-testid="board-intel-panel">
      <h2>On3 Prediction Market</h2>
      <p className="fc-profile-muted fc-profile-section__lede">
        Public On3 RPM market — not the GatorVault model
      </p>
      {leader ? (
        <p className="fc-board-intel__lead">
          <strong>{leader.school}</strong> leads at {leader.pct}%
          {ufPct != null && ufPct > 0 && leader.school !== 'Florida' ? (
            <span className="fc-profile-muted"> · Florida at {ufPct}%</span>
          ) : null}
        </p>
      ) : null}
      {rows.length > 0 ? (
        <ol className="fc-school-rank-list fc-board-intel__list">
          {rows.map((row, i) => (
            <SchoolRankRow
              key={row.school}
              rank={i + 1}
              school={row.school}
              pct={row.pct}
              emphasize={i === 0 || /^florida$/i.test(row.school)}
            />
          ))}
        </ol>
      ) : null}
      {note ? <p className="fc-board-intel__note">{note}</p> : null}
    </section>
  );
}
