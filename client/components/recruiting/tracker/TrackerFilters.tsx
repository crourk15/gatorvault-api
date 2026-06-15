'use client';

import React from 'react';
import type { TrackerStatusFilter } from '@/lib/recruiting-tracker-api';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  sort: 'rating' | 'ranking' | 'name' | 'status';
  onSortChange: (value: Props['sort']) => void;
  statusFilter: TrackerStatusFilter;
  onStatusFilterChange: (value: TrackerStatusFilter) => void;
  classYear: number;
  onClassYearChange: (year: number) => void;
  lastUpdated: string | null;
};

export function TrackerFilters({
  search,
  onSearchChange,
  sort,
  onSortChange,
  statusFilter,
  onStatusFilterChange,
  classYear,
  onClassYearChange,
  lastUpdated,
}: Props): React.ReactElement {
  const updatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="tracker-filters" data-testid="tracker-filters">
      <input
        type="search"
        className="tracker-filters__search"
        placeholder="Search players…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <select
        className="tracker-filters__select"
        value={classYear}
        onChange={(e) => onClassYearChange(Number(e.target.value))}
      >
        <option value={2027}>Class of 2027</option>
        <option value={2026}>Class of 2026</option>
        <option value={2028}>Class of 2028</option>
      </select>
      <select
        className="tracker-filters__select"
        value={sort}
        onChange={(e) => onSortChange(e.target.value as Props['sort'])}
      >
        <option value="rating">Sort: Rating</option>
        <option value="ranking">Sort: Ranking</option>
        <option value="status">Sort: Status</option>
        <option value="name">Sort: Name</option>
      </select>
      <select
        className="tracker-filters__select"
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value as TrackerStatusFilter)}
      >
        <option value="all">All statuses</option>
        <option value="Committed">Committed</option>
        <option value="Trending">Trending</option>
        <option value="Offered">Offered</option>
        <option value="Warm">Warm</option>
        <option value="Cold">Cold</option>
      </select>
      {updatedLabel ? (
        <p className="tracker-filters__updated">Last updated {updatedLabel}</p>
      ) : null}
    </div>
  );
}
