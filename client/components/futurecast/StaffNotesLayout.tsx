'use client';

import React, { useMemo, useState } from 'react';
import { FutureCastSubPageHero } from './FutureCastSubPageHero';
import { StaffNoteCard } from './StaffNoteCard';
import {
  StaffNotesFilters,
  applyStaffNotesFilters,
  type StaffNotesFilterState,
} from './StaffNotesFilters';
import { FutureCastInsiderCTA } from './FutureCastInsiderCTA';
import { FutureCastPanelShell } from './lab/primitives';
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
    <div className="rh-cc-page fc-lab-cc-page" data-testid="fc-staff-notes-layout">
      <FutureCastSubPageHero
        title="Staff Notes"
        sub="Insider evaluations, scouting intel, and analyst confidence for UF targets."
        badge={`Updated ${new Date(updatedAt).toLocaleString()} · ${totalNotes} evaluations`}
        metrics={[
          { label: 'Evaluations', value: totalNotes, highlight: true },
          { label: 'Showing', value: visible.length },
          { label: 'Positions', value: positions.length || '—' },
        ]}
      />

      <div className="rh-cc-main rh-frame">
        <div className="rh-cc-col">
          {insider ? (
            <section>
              <FutureCastPanelShell title="Filters" sub="Narrow by position, priority, and fit." testId="fc-staff-filters">
                <StaffNotesFilters filters={filters} onChange={setFilters} positions={positions} />
              </FutureCastPanelShell>
            </section>
          ) : null}
          <section>
            <FutureCastPanelShell
              title="Analyst Evaluations"
              sub={insider ? 'Full staff notes board.' : 'Preview — unlock Insider for full access.'}
              testId="fc-staff-notes-grid"
            >
              <div className="fc-premium-staff-grid">
                {visible.map((note) => (
                  <StaffNoteCard
                    key={`${note.playerName}-${note.updatedAt ?? note.createdAt ?? note.id ?? ''}`}
                    note={note}
                    blurred={!insider}
                  />
                ))}
                {visible.length === 0 ? <p className="rh-cc-empty">No staff notes for this filter.</p> : null}
              </div>
            </FutureCastPanelShell>
          </section>
        </div>
      </div>

      {!insider ? <FutureCastInsiderCTA limit={3} total={filtered.length} /> : null}
    </div>
  );
}
