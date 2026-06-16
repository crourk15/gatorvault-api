'use client';

import React, { useMemo, useState } from 'react';
import { Tabs } from '@/components/ui';
import { ClassSummaryBar } from '@/components/vault/RecruitingBoardClassic';
import { RecruitingEvalSections } from '@/components/vault/recruiting/RecruitingEvalSections';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import type { RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import { formatRank } from '@/lib/recruiting-board-utils';

type ClassBundle = {
  commits: RecruitingBoardPlayer[];
  rankings: RecruitingBoardResponse['rankings'];
};

type Props = {
  b26: ClassBundle;
  b27: ClassBundle;
  b28: ClassBundle;
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

function topCommits(commits: RecruitingBoardPlayer[], limit = 3): RecruitingBoardPlayer[] {
  return [...commits]
    .sort((a, b) => {
      const ra = a.natlRank ?? a.natl ?? 9999;
      const rb = b.natlRank ?? b.natl ?? 9999;
      return ra - rb;
    })
    .slice(0, limit);
}

export function RecruitingHubClassOverview({ b26, b27, b28 }: Props): React.ReactElement {
  const [year, setYear] = useState('2027');

  const bundle = year === '2026' ? b26 : year === '2028' ? b28 : b27;
  const classYear = year === '2026' ? 2026 : year === '2028' ? 2028 : 2027;
  const compareRankings = useMemo(() => {
    if (classYear === 2027) return b26.rankings;
    if (classYear === 2028) return b27.rankings;
    return null;
  }, [classYear, b26.rankings, b27.rankings]);

  const featured = useMemo(() => topCommits(bundle.commits), [bundle.commits]);

  return (
    <section className="gv-rh-class gv-rh-hub__frame" data-testid="rh-class-overview">
      <div className="gv-rh-class__header">
        <h2 className="gv-rh-class__title">Class Overview</h2>
        <Tabs options={TAB_OPTIONS} active={year} onChange={setYear} aria-label="Recruiting class year" />
      </div>
      <ClassSummaryBar
        commits={bundle.commits}
        rankings={bundle.rankings}
        classYear={classYear}
        compareRankings={compareRankings ?? undefined}
      />
      <p className="gv-rh-class__avg">Avg composite: {avgStars(bundle.commits)}</p>

      {featured.length > 0 ? (
        <div className="gv-rh-class__detail">
          <h3 className="gv-rh-class__detail-title">Top commits — full eval</h3>
          <div className="gv-rh-class__detail-grid">
            {featured.map((player) => (
              <article key={player.slug} className="gv-ds-card gv-rh-class-player">
                <h4 className="gv-rh-class-player__name">{player.name}</h4>
                <p className="gv-rh-class-player__meta">
                  {player.pos ?? player.position ?? '—'} · NATL {formatRank(player.natlRank ?? player.natl)} ·{' '}
                  {player.stars ? `${player.stars}★` : '—'}
                </p>
                <RecruitingEvalSections player={player} />
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
