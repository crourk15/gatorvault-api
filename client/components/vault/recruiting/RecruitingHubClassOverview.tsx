'use client';

import React, { useState } from 'react';
import { Tabs } from '@/components/ui';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import type { RecruitingBoardResponse } from '@/lib/recruiting-board-api';

type Props = {
  b26: { commits: RecruitingBoardPlayer[]; rankings: RecruitingBoardResponse['rankings'] };
  b27: { commits: RecruitingBoardPlayer[]; rankings: RecruitingBoardResponse['rankings'] };
  b28: { commits: RecruitingBoardPlayer[]; rankings: RecruitingBoardResponse['rankings'] };
};

const TAB_OPTIONS = [
  { id: '2026', label: '2026' },
  { id: '2027', label: '2027' },
  { id: '2028', label: '2028' },
];

function avgStars(players: RecruitingBoardPlayer[]): string {
  if (!players.length) return '—';
  const sum = players.reduce((acc, p) => acc + (Number(p.stars) || 0), 0);
  return (sum / players.length).toFixed(1);
}

function inStatePct(players: RecruitingBoardPlayer[]): string {
  if (!players.length) return '—';
  const count = players.filter((p) => p.inState).length;
  return `${Math.round((count / players.length) * 100)}%`;
}

function blueChipCount(players: RecruitingBoardPlayer[]): number {
  return players.filter((p) => (Number(p.stars) || 0) >= 4).length;
}

export function RecruitingHubClassOverview({ b26, b27, b28 }: Props): React.ReactElement {
  const [year, setYear] = useState('2027');

  const bundle =
    year === '2026' ? b26 : year === '2028' ? b28 : b27;
  const rankings = bundle.rankings;
  const commits = bundle.commits;

  const stats = [
    { label: 'Commits', value: String(commits.length) },
    { label: 'National Rank', value: rankings?.nationalRank != null ? `#${rankings.nationalRank}` : '—' },
    { label: 'SEC Rank', value: rankings?.secRank != null ? `#${rankings.secRank}` : '—' },
    { label: 'Class Score', value: rankings?.classScore != null ? rankings.classScore.toFixed(1) : '—' },
    { label: 'Prior Year Score', value: '—' },
    { label: 'Prior SEC Rank', value: '—' },
    { label: 'Blue Chips', value: String(blueChipCount(commits)) },
    { label: 'In-State %', value: inStatePct(commits) },
    { label: 'Head Coach', value: 'Jon Sumrall' },
  ];

  return (
    <section className="gv-rh-class gv-rh-hub__frame" data-testid="rh-class-overview">
      <div className="gv-rh-class__header">
        <h2 className="gv-rh-class__title">Class Overview</h2>
        <Tabs options={TAB_OPTIONS} active={year} onChange={setYear} aria-label="Recruiting class year" />
      </div>
      <div className="gv-rh-class__stats gv-rh-class__stats--expanded">
        {stats.map((stat) => (
          <article key={stat.label} className="gv-ds-card gv-rh-class-stat">
            <p className="gv-rh-class-stat__value">{stat.value}</p>
            <p className="gv-rh-class-stat__label">{stat.label}</p>
          </article>
        ))}
      </div>
      <p className="gv-rh-class__avg">Avg composite: {avgStars(commits)}</p>
    </section>
  );
}
