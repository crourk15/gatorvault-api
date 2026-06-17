'use client';

import React, { useMemo, useState } from 'react';
import { Tabs } from '@/components/ui';
import type { RecruitingBoardPlayer, RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { NeedsMeter } from './NeedsMeter';
import { RankSimulator } from './RankSimulator';

type ClassBundle = {
  commits: RecruitingBoardPlayer[];
  targets: RecruitingBoardPlayer[];
  rankings: RecruitingBoardResponse['rankings'];
};

type Props = {
  b26: ClassBundle;
  b27: ClassBundle;
  b28: ClassBundle;
  highPriority: HighPriorityPlayer[];
};

const YEAR_TABS = [
  { id: '2026', label: '2026' },
  { id: '2027', label: '2027' },
  { id: '2028', label: '2028' },
];

type SummaryProps = {
  commits: RecruitingBoardPlayer[];
  rankings: RecruitingBoardResponse['rankings'];
};

export function ClassSummary({ commits, rankings }: SummaryProps): React.ReactElement {
  const blueChipPct = commits.length
    ? Math.round((commits.filter((c) => (Number(c.stars) || 0) >= 4).length / commits.length) * 100)
    : 0;
  const inStatePct = commits.length
    ? Math.round(
        (commits.filter((c) => c.inState || String(c.state || '').toUpperCase() === 'FL').length / commits.length) *
          100
      )
    : 0;
  const avgRating =
    commits.filter((c) => c.rating).length > 0
      ? (
          commits.reduce((acc, c) => acc + Number(c.rating || 0), 0) / commits.filter((c) => c.rating).length
        ).toFixed(4)
      : '—';

  return (
    <div className="rh-class-summary">
      <div className="rh-class-summary__stat">
        <span>Commits</span>
        <strong>{commits.length}</strong>
      </div>
      <div className="rh-class-summary__stat">
        <span>Class Score</span>
        <strong>{rankings?.classScore != null ? Number(rankings.classScore).toFixed(2) : '—'}</strong>
      </div>
      <div className="rh-class-summary__stat">
        <span>Avg Rating</span>
        <strong>{avgRating}</strong>
      </div>
      <div className="rh-class-summary__stat">
        <span>Blue Chip %</span>
        <strong>{blueChipPct}%</strong>
      </div>
      <div className="rh-class-summary__stat">
        <span>In-State %</span>
        <strong>{inStatePct}%</strong>
      </div>
    </div>
  );
}

export function ClassEngineSection({ b26, b27, b28, highPriority }: Props): React.ReactElement {
  const [year, setYear] = useState('2027');
  const bundle = year === '2026' ? b26 : year === '2028' ? b28 : b27;
  const classYear = year === '2026' ? 2026 : year === '2028' ? 2028 : 2027;
  const commits = useMemo(
    () => bundle.commits.filter((p) => Number(p.classYear) === classYear),
    [bundle.commits, classYear]
  );
  const blueChipPct = commits.length
    ? Math.round((commits.filter((c) => (Number(c.stars) || 0) >= 4).length / commits.length) * 100)
    : 0;

  return (
    <section className="rh-section rh-section--panel rh-container" data-testid="rh-class-engine-section">
      <div className="rh-class-engine__head">
        <h2 className="rh-section__title">Class Engine</h2>
        <Tabs options={YEAR_TABS} active={year} onChange={setYear} aria-label="Recruiting class year" />
      </div>
      <ClassSummary commits={commits} rankings={bundle.rankings} />
      <NeedsMeter targets={bundle.targets} />
      <RankSimulator targets={highPriority} rankings={bundle.rankings} blueChipPct={blueChipPct} />
    </section>
  );
}
