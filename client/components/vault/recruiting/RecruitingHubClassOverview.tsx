'use client';

import React, { useState } from 'react';
import { Tabs } from '@/components/ui';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import type { RecruitingBoardResponse } from '@/lib/recruiting-board-api';

type Props = {
  b27: { commits: RecruitingBoardPlayer[]; rankings: RecruitingBoardResponse['rankings'] };
  b28: { commits: RecruitingBoardPlayer[] };
};

const TAB_OPTIONS = [
  { id: '2025', label: '2025' },
  { id: '2026', label: '2026' },
  { id: '2027', label: '2027' },
];

function avgStars(players: RecruitingBoardPlayer[]): string {
  if (!players.length) return '—';
  const sum = players.reduce((acc, p) => acc + (Number(p.stars) || 0), 0);
  return (sum / players.length).toFixed(1);
}

export function RecruitingHubClassOverview({ b27, b28 }: Props): React.ReactElement {
  const [year, setYear] = useState('2027');

  const stats =
    year === '2027'
      ? {
          commits: b27.commits.length,
          avg: avgStars(b27.commits),
          rank: b27.rankings?.nationalRank ?? '—',
        }
      : year === '2026'
        ? { commits: '—', avg: '—', rank: '—' }
        : { commits: b28.commits.length, avg: avgStars(b28.commits), rank: '—' };

  return (
    <section className="gv-rh-class gv-rh-hub__frame" data-testid="rh-class-overview">
      <div className="gv-rh-class__header">
        <h2 className="gv-rh-class__title">Class Overview</h2>
        <Tabs options={TAB_OPTIONS} active={year} onChange={setYear} aria-label="Recruiting class year" />
      </div>
      <div className="gv-rh-class__stats">
        <article className="gv-ds-card gv-rh-class-stat">
          <p className="gv-rh-class-stat__value">{stats.commits}</p>
          <p className="gv-rh-class-stat__label">Commits</p>
        </article>
        <article className="gv-ds-card gv-rh-class-stat">
          <p className="gv-rh-class-stat__value">{stats.avg}</p>
          <p className="gv-rh-class-stat__label">Avg Rating</p>
        </article>
        <article className="gv-ds-card gv-rh-class-stat">
          <p className="gv-rh-class-stat__value">{stats.rank}</p>
          <p className="gv-rh-class-stat__label">Class Rank</p>
        </article>
      </div>
    </section>
  );
}
