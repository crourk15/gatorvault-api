'use client';

import React from 'react';
import type { StaffNote } from '@/lib/futurecast-board-types';

export type StaffNotesFilterState = {
  position: string;
  priority: string;
  minFit: number;
};

type Props = {
  filters: StaffNotesFilterState;
  onChange: (next: StaffNotesFilterState) => void;
  positions: string[];
};

export function StaffNotesFilters({ filters, onChange, positions }: Props): React.ReactElement {
  return (
    <div className="fc-staff-notes-filters" role="toolbar" aria-label="Staff notes filters">
      <label>
        Position
        <select
          value={filters.position}
          onChange={(e) => onChange({ ...filters, position: e.target.value })}
        >
          <option value="">All</option>
          {positions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label>
        Priority
        <select
          value={filters.priority}
          onChange={(e) => onChange({ ...filters, priority: e.target.value })}
        >
          <option value="">All</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </label>
      <label>
        Min fit
        <input
          type="number"
          min={0}
          max={100}
          value={filters.minFit || ''}
          onChange={(e) => onChange({ ...filters, minFit: parseFloat(e.target.value) || 0 })}
        />
      </label>
    </div>
  );
}

export function applyStaffNotesFilters(
  notes: StaffNote[],
  filters: StaffNotesFilterState
): StaffNote[] {
  return notes.filter((n) => {
    if (filters.position && n.position !== filters.position) return false;
    if (filters.priority && n.priority !== filters.priority) return false;
    if (filters.minFit > 0 && (n.fitScore ?? 0) < filters.minFit) return false;
    return true;
  });
}
