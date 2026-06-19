'use client';

import React, { useEffect, useState } from 'react';
import type { CommitCardProps } from './mapCommits';
import { CommitCard } from './CommitCard';
import './commits-section.css';

type ClassYear = '2026' | '2027' | '2028';

type Props = {
  commits2026: CommitCardProps[];
  commits2027: CommitCardProps[];
  commits2028: CommitCardProps[];
};

const YEAR_TABS: { id: ClassYear; label: string; year: number }[] = [
  { id: '2026', label: '2026', year: 2026 },
  { id: '2027', label: '2027', year: 2027 },
  { id: '2028', label: '2028', year: 2028 },
];

function parseYearFromSearch(): ClassYear {
  if (typeof window === 'undefined') return '2026';
  const raw = new URLSearchParams(window.location.search).get('year');
  if (raw === '2026' || raw === '2027' || raw === '2028') return raw;
  return '2026';
}

export function CommitsSection({ commits2026, commits2027, commits2028 }: Props): React.ReactElement {
  const [activeYear, setActiveYear] = useState<ClassYear>(() => parseYearFromSearch());

  useEffect(() => {
    setActiveYear(parseYearFromSearch());
    const onNav = () => setActiveYear(parseYearFromSearch());
    window.addEventListener('popstate', onNav);
    return () => window.removeEventListener('popstate', onNav);
  }, []);

  const byYear: Record<ClassYear, CommitCardProps[]> = {
    '2026': commits2026,
    '2027': commits2027,
    '2028': commits2028,
  };

  const activeCommits = byYear[activeYear];

  const selectYear = (year: ClassYear) => {
    setActiveYear(year);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('year', year);
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    }
  };

  return (
    <section className="commits-section rh-section rh-section--panel rh-container" data-testid="rh-commits-section">
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
            onClick={() => selectYear(tab.id)}
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
