'use client';

import React, { useMemo, useState } from 'react';
import { Tabs } from '@/components/ui';
import type { RecruitingBoardPlayer, RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import { StatsBar } from './StatsBar';
import { TopCommitList } from './TopCommitList';
import { YearOverYearChart } from './YearOverYearChart';

type ClassBundle = {
  commits: RecruitingBoardPlayer[];
  rankings: RecruitingBoardResponse['rankings'];
};

type Props = {
  b26: ClassBundle;
  b27: ClassBundle;
  b28: ClassBundle;
};

const YEAR_TABS = [
  { id: '2026', label: '2026' },
  { id: '2027', label: '2027' },
  { id: '2028', label: '2028' },
];

function topCommits(commits: RecruitingBoardPlayer[], limit = 3): RecruitingBoardPlayer[] {
  return [...commits]
    .sort((a, b) => {
      const ra = a.natlRank ?? a.natl ?? 9999;
      const rb = b.natlRank ?? b.natl ?? 9999;
      return ra - rb;
    })
    .slice(0, limit);
}

export function ClassOverview({ b26, b27, b28 }: Props): React.ReactElement {
  const [year, setYear] = useState('2027');

  const bundle = year === '2026' ? b26 : year === '2028' ? b28 : b27;
  const classYear = year === '2026' ? 2026 : year === '2028' ? 2028 : 2027;
  const classCommits = useMemo(
    () => bundle.commits.filter((p) => Number(p.classYear) === classYear),
    [bundle.commits, classYear]
  );
  const compareRankings = useMemo(() => {
    if (classYear === 2027) return b26.rankings;
    if (classYear === 2028) return b27.rankings;
    return null;
  }, [classYear, b26.rankings, b27.rankings]);

  const featured = useMemo(() => topCommits(classCommits), [classCommits]);

  return (
    <section className="rh-class-overview rh-frame" data-testid="rh-class-overview">
      <div className="rh-class-overview__header">
        <h2 className="rh-section-title">Class Overview</h2>
        <Tabs options={YEAR_TABS} active={year} onChange={setYear} aria-label="Recruiting class year" />
      </div>
      <StatsBar
        commits={classCommits}
        rankings={bundle.rankings}
        compareRankings={compareRankings ?? undefined}
        classYear={classYear}
      />
      <YearOverYearChart
        classYear={classYear}
        rankings={bundle.rankings}
        compareRankings={compareRankings}
      />
      <TopCommitList players={featured} />
    </section>
  );
}
