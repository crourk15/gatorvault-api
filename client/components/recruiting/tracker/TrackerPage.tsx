'use client';

import React, { useEffect, useMemo, useState } from 'react';
import '@/lib/recruiting-tracker.css';
import { useRecruitingData } from '@/hooks/use-recruiting-data';
import {
  filterTrackerPlayers,
  sortTrackerPlayers,
  type TrackerStatusFilter,
} from '@/lib/recruiting-tracker-api';
import { TrackerFilters } from './TrackerFilters';
import { TrackerList } from './TrackerList';
import { TrackerSkeleton } from './TrackerSkeleton';

type Props = {
  classYear?: number;
  staffMode?: boolean;
};

/** Recruiting Tracker — list view wired to tracker-api / useRecruitingData. */
export function TrackerPage({ classYear = 2027, staffMode = false }: Props): React.ReactElement {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<'rating' | 'ranking' | 'name' | 'status'>('rating');
  const [statusFilter, setStatusFilter] = useState<TrackerStatusFilter>('all');
  const [year, setYear] = useState(classYear);

  const { players, loading, error, updatedAt, reload } = useRecruitingData(year, staffMode);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const visible = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    let out = players;
    if (q) {
      out = out.filter((p) =>
        [p.name, p.school, p.position, p.offerStatus, p.prediction]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    return sortTrackerPlayers(filterTrackerPlayers(out, statusFilter), sort);
  }, [players, debouncedSearch, statusFilter, sort]);

  return (
    <div className="tracker-page" data-testid="recruiting-tracker-page">
      <h1 className="gv-page-title">Recruiting Tracker</h1>
      <TrackerFilters
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        classYear={year}
        onClassYearChange={setYear}
        lastUpdated={updatedAt}
      />
      {loading ? <TrackerSkeleton rows={8} /> : null}
      {error ? (
        <p className="gv-page-status" role="alert">
          {error}{' '}
          <button type="button" className="gv-page-link" onClick={reload}>
            Retry
          </button>
        </p>
      ) : null}
      {!loading && !error ? <TrackerList players={visible} /> : null}
    </div>
  );
}
