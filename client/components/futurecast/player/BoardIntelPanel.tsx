/**
 * On3 RPM / competing-school intel for player profile overview.
 */
import React from 'react';
import type { FullProfileCompetingSchool, FullProfileFuturecastSummary } from '@/lib/player-full-profile-api';

export interface BoardIntelPanelProps {
  ufProbability: number | null;
  competingSchools: FullProfileCompetingSchool[];
  futurecastSummary?: FullProfileFuturecastSummary | null;
  staffNote?: string | null;
}

type BoardRow = { school: string; pct: number; tone: 'uf' | 'peer' | 'other' };

function buildBoardRows(
  ufProbability: number | null,
  competingSchools: FullProfileCompetingSchool[]
): BoardRow[] {
  const rows: BoardRow[] = [];
  if (ufProbability != null && ufProbability > 0) {
    rows.push({ school: 'Florida', pct: ufProbability, tone: 'uf' });
  }
  for (const [i, c] of competingSchools.entries()) {
    const pct = c.pct != null && c.pct > 0 ? c.pct : null;
    if (pct == null) continue;
    rows.push({
      school: c.school,
      pct,
      tone: i === 0 ? 'peer' : 'other',
    });
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
        Live On3 RPM board — Florida and competing schools
      </p>
      {leader ? (
        <p className="fc-board-intel__lead">
          <strong>{leader.school}</strong> leads at {leader.pct}%
          {ufPct != null && ufPct > 0 && leader.school !== 'Florida' ? (
            <span className="fc-profile-muted"> · UF at {ufPct}%</span>
          ) : null}
        </p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="fc-prediction-list fc-board-intel__list">
          {rows.map((row) => (
            <li key={row.school} className="fc-prediction-item">
              <span className="fc-prediction-item__school">{row.school}</span>
              <div className="fc-prediction-item__bar-wrap">
                <div
                  className={`fc-prediction-item__bar fc-prediction-item__bar--${row.tone}`}
                  style={{ width: `${Math.min(100, Math.max(4, row.pct))}%` }}
                />
              </div>
              <span className="fc-prediction-item__score">{row.pct}%</span>
            </li>
          ))}
        </ul>
      ) : null}
      {note ? <p className="fc-board-intel__note">{note}</p> : null}
    </section>
  );
}
