'use client';

import React, { useMemo, useState } from 'react';
import { FutureCastHero } from './FutureCastHero';
import { StaffNoteCard } from './StaffNoteCard';
import {
  StaffNotesFilters,
  applyStaffNotesFilters,
  type StaffNotesFilterState,
} from './StaffNotesFilters';
import { FutureCastInsiderCTA } from './FutureCastInsiderCTA';
import { isFutureCastInsider } from '@/lib/futurecast-insider';
import type { StaffNote } from '@/lib/futurecast-board-types';

type Props = {
  notes: StaffNote[];
  updatedAt: string;
  totalNotes: number;
};

const DEFAULT: StaffNotesFilterState = { position: '', priority: '', minFit: 0 };

export function StaffNotesLayout({ notes, updatedAt, totalNotes }: Props): React.ReactElement {
  const [filters, setFilters] = useState<StaffNotesFilterState>(DEFAULT);
  const insider = isFutureCastInsider();
  const positions = useMemo(
    () => [...new Set(notes.map((n) => n.position).filter(Boolean) as string[])].sort(),
    [notes]
  );
  const filtered = applyStaffNotesFilters(notes, filters);
  const visible = insider ? filtered : filtered.slice(0, 3);

  return (
    <div className="gv-elite-stack fc-elite-page" data-testid="fc-staff-notes-layout">
      <FutureCastHero
        badge={`Updated ${new Date(updatedAt).toLocaleString()} · ${totalNotes} evaluations`}
      />
      {insider ? (
        <StaffNotesFilters filters={filters} onChange={setFilters} positions={positions} />
      ) : null}
      <div className="gv-staff-grid fc-staff-notes-elite-grid">
        {visible.map((note) => (
          <StaffNoteCard
            key={`${note.playerName}-${note.updatedAt ?? note.createdAt ?? note.id ?? ''}`}
            note={note}
            blurred={!insider}
          />
        ))}
        {visible.length === 0 ? <p className="fc-elite-empty">No staff notes for this filter.</p> : null}
      </div>
      {!insider ? <FutureCastInsiderCTA limit={3} total={filtered.length} /> : null}
    </div>
  );
}
