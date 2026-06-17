'use client';

import React, { useState } from 'react';
import type { CommitCardProps } from './mapCommits';
import { CommitCard } from './CommitCard';
import './commits-section.css';

type ClassYear = '2026' | '2027' | '2028';

type Props = {
  commits2026: CommitCardProps[];
  commits2027: CommitCardProps[];
  commits2028: CommitCardProps[];
};

const YEAR_TABS: { id: ClassYear; label: string }[] = [
  { id: '2026', label: '2026' },
  { id: '2027', label: '2027' },
  { id: '2028', label: '2028' },
];

export function CommitsSection({ commits2026, commits2027, commits2028 }: Props): React.ReactElement {
  const [activeYear, setActiveYear] = useState<ClassYear>('2026');

  const byYear: Record<ClassYear, CommitCardProps[]> = {
    '2026': commits2026,
    '2027': commits2027,
    '2028': commits2028,
  };

  const activeCommits = byYear[activeYear];

  return (
    <section className="commits-section rh-container" data-testid="rh-commits-section">
      <header className="commits-section__header">
        <h2 className="commits-section__title">Florida Gators Recruiting Class</h2>
        <p className="commits-section__sub">2026 and beyond — verified commits, real-time updates.</p>
      </header>

      <div className="commits-section__tabs" role="tablist" aria-label="Recruiting class year">
        {YEAR_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeYear === tab.id}
            className={`commits-section__tab${activeYear === tab.id ? ' commits-section__tab--active' : ''}`}
            onClick={() => setActiveYear(tab.id)}
          >
            Class of {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={`Class of ${activeYear} commits`}>
        {activeCommits.length === 0 ? (
          <p className="commits-section__empty">No {activeYear} commits loaded yet.</p>
        ) : (
          <div className="commits-section__scroll" role="list">
            {activeCommits.map((commit) => (
              <CommitCard key={`${activeYear}-${commit.playerId}`} {...commit} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
