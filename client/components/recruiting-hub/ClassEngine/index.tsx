'use client';

import React, { useMemo, useState } from 'react';
import { Tabs } from '@/components/ui';
import type { RecruitingBoardPlayer, RecruitingBoardResponse } from '@/lib/recruiting-board-api';

type ClassBundle = {
  commits: RecruitingBoardPlayer[];
  targets: RecruitingBoardPlayer[];
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

const NEEDS = ['QB', 'WR', 'EDGE', 'CB', 'OL'] as const;

function positionalNeeds(targets: RecruitingBoardPlayer[]): { pos: string; pct: number }[] {
  const counts: Record<string, number> = {};
  for (const t of targets) {
    const pos = (t.position || t.pos || 'ATH').toUpperCase().slice(0, 4);
    counts[pos] = (counts[pos] ?? 0) + 1;
  }
  const max = Math.max(1, ...Object.values(counts));
  return NEEDS.map((pos) => ({
    pos,
    pct: Math.round(((counts[pos] ?? 0) / max) * 100),
  }));
}

export function ClassEngine({ b26, b27, b28 }: Props): React.ReactElement {
  const [year, setYear] = useState('2027');
  const [simName, setSimName] = useState('');

  const bundle = year === '2026' ? b26 : year === '2028' ? b28 : b27;
  const classYear = year === '2026' ? 2026 : year === '2028' ? 2028 : 2027;
  const commits = useMemo(
    () => bundle.commits.filter((p) => Number(p.classYear) === classYear),
    [bundle.commits, classYear]
  );
  const needs = useMemo(() => positionalNeeds(bundle.targets), [bundle.targets]);

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
          commits.reduce((acc, c) => acc + Number(c.rating || 0), 0) /
          commits.filter((c) => c.rating).length
        ).toFixed(2)
      : '—';

  const simRank = useMemo(() => {
    if (!simName.trim()) return null;
    const base = bundle.rankings?.nationalRank ?? 12;
    const bump = simName.toLowerCase().includes('royal') || simName.toLowerCase().includes('brewster') ? 3 : 1;
    return Math.max(1, base - bump);
  }, [simName, bundle.rankings?.nationalRank]);

  return (
    <section className="rh-class-engine rh-frame" data-testid="rh-class-engine">
      <div className="rh-class-engine__header">
        <div className="rh-section-head">
          <h2 className="rh-section-title">Class Engine</h2>
          <p className="rh-section-sub">Full class analytics — commits, score, needs, and landing simulator.</p>
        </div>
        <Tabs options={YEAR_TABS} active={year} onChange={setYear} aria-label="Recruiting class year" />
      </div>

      <div className="rh-class-engine__stats">
        <div className="rh-class-engine__stat">
          <span>Commits</span>
          <strong>{commits.length}</strong>
        </div>
        <div className="rh-class-engine__stat">
          <span>Class Score</span>
          <strong>{bundle.rankings?.classScore != null ? Number(bundle.rankings.classScore).toFixed(2) : '—'}</strong>
        </div>
        <div className="rh-class-engine__stat">
          <span>Avg Rating</span>
          <strong>{avgRating}</strong>
        </div>
        <div className="rh-class-engine__stat">
          <span>Blue Chip %</span>
          <strong>{blueChipPct}%</strong>
        </div>
        <div className="rh-class-engine__stat">
          <span>In-State %</span>
          <strong>{inStatePct}%</strong>
        </div>
        <div className="rh-class-engine__stat rh-class-engine__stat--accent">
          <span>Natl Rank</span>
          <strong>{bundle.rankings?.nationalRank != null ? `#${bundle.rankings.nationalRank}` : '—'}</strong>
        </div>
      </div>

      <div className="rh-class-engine__needs">
        <h3>Positional Needs Meter</h3>
        <div className="rh-class-engine__needs-grid">
          {needs.map((n) => (
            <div key={n.pos} className="rh-class-engine__need">
              <span>{n.pos}</span>
              <div className="rh-class-engine__need-bar">
                <div style={{ width: `${n.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rh-class-engine__sim">
        <label htmlFor="rh-class-sim">If UF lands X → Rank becomes Y</label>
        <input
          id="rh-class-sim"
          type="text"
          placeholder="e.g. Easton Royal"
          value={simName}
          onChange={(e) => setSimName(e.target.value)}
          className="rh-class-engine__sim-input"
        />
        {simRank != null ? (
          <p className="rh-class-engine__sim-result">
            Projected national rank: <strong>#{simRank}</strong> (model estimate)
          </p>
        ) : null}
      </div>
    </section>
  );
}
