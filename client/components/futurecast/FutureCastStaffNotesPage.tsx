'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { FutureCastElitePageShell } from '@/components/futurecast/FutureCastElitePageShell';
import { FutureCastSubPageHero } from '@/components/futurecast/FutureCastSubPageHero';
import { FutureCastSubPageLoading } from '@/components/futurecast/FutureCastSubPageLoading';
import { FutureCastPanelShell } from '@/components/futurecast/lab/primitives';
import {
  loadFutureCastStaffNotes,
  readFutureCastStaffNotesCache,
  STAFF_NOTES_YEAR,
  type FutureCastStaffNote,
  type FutureCastStaffNotesResponse,
  type StaffNotesLoadMeta,
} from '@/lib/futurecast-staff-notes-api';
import { playerProfilePath } from '@/lib/player-routes';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

function formatUpdatedAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function NoteSkeletonGrid(): React.ReactElement {
  return <FutureCastSubPageLoading testId="fc-staff-notes-skeleton" />;
}

function BreakdownCard({ entry }: { entry: FutureCastStaffNote }): React.ReactElement {
  const href = playerProfilePath(entry.playerSlug, 'HIGH_SCHOOL', true, entry.playerName, 'futurecast');
  const metaParts = [
    entry.position,
    entry.school,
    entry.classYear ? `Class of ${entry.classYear}` : null,
    entry.nationalRank != null ? `#${entry.nationalRank} natl` : null,
  ].filter(Boolean);

  return (
    <a href={href} className="fc-lab-signal-card fc-premium-staff-card" data-testid="fc-staff-note-card">
      <h3 className="fc-lab-signal-card__player">{entry.playerName}</h3>
      {entry.compositeScore > 0 ? (
        <p className="fc-lab-signal-card__summary">{entry.compositeScore.toFixed(2)} Composite</p>
      ) : null}
      {metaParts.length ? <p className="fc-lab-signal-card__summary">{metaParts.join(' · ')}</p> : null}
      {entry.projection ? <p className="fc-lab-signal-card__summary">{entry.projection}</p> : null}
      {entry.notePreview ? <p className="fc-lab-signal-card__summary">{entry.notePreview}</p> : null}
      {entry.comparison ? <p className="fc-lab-signal-card__summary">Comp: {entry.comparison}</p> : null}
      {entry.analystName ? <p className="fc-lab-signal-card__analyst">{entry.analystName}</p> : null}
    </a>
  );
}

function StaffNotesContent({
  data,
  fromCache,
}: {
  data: FutureCastStaffNotesResponse;
  fromCache: boolean;
}): React.ReactElement {
  return (
    <div className="rh-cc-page fc-lab-cc-page">
      <FutureCastSubPageHero
        title="Staff Notes"
        sub={`Live insider evaluations and scouting intel for ${STAFF_NOTES_YEAR}+ Florida targets.`}
        badge={`${fromCache ? 'Cached · ' : 'Updated '}${formatUpdatedAt(data.updatedAt)} · ${data.count} evaluations`}
        metrics={[{ label: 'Evaluations', value: data.count, highlight: true }]}
      />
      <div className="rh-cc-main rh-frame">
        <div className="rh-cc-col">
          <section>
            <FutureCastPanelShell title="Analyst Evaluations" sub="Staff scouting breakdowns and projections.">
              <div className="fc-premium-staff-grid">
                {data.notes.map((entry) => (
                  <BreakdownCard key={entry.playerSlug} entry={entry} />
                ))}
                {data.notes.length === 0 ? (
                  <UiEmpty message={`No staff notes for the ${STAFF_NOTES_YEAR} cycle yet.`} />
                ) : null}
              </div>
            </FutureCastPanelShell>
          </section>
        </div>
      </div>
    </div>
  );
}

function FutureCastStaffNotesPageInner(): React.ReactElement {
  const [data, setData] = useState<FutureCastStaffNotesResponse | null>(null);
  const [meta, setMeta] = useState<StaffNotesLoadMeta | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const dataRef = useRef<FutureCastStaffNotesResponse | null>(null);

  const load = useCallback(async (isBackground: boolean) => {
    if (!isBackground && !dataRef.current) setHydrating(true);

    const result = await loadFutureCastStaffNotes();
    if (result.data) {
      dataRef.current = result.data;
      setData(result.data);
      setMeta(result.meta);
      setFromCache(result.meta.fromCache);
    } else if (!dataRef.current) {
      setMeta(result.meta);
    }
    setHydrating(false);
  }, []);

  useEffect(() => {
    const cached = readFutureCastStaffNotesCache();
    if (cached) {
      dataRef.current = cached;
      setData(cached);
      setFromCache(true);
      setHydrating(false);
    }

    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await load(!!cached);
    })();

    return () => {
      cancelled = true;
    };
  }, [load]);

  const offline = meta?.offline;
  const timedOut = meta?.timedOut;

  return (
    <FutureCastElitePageShell segment="staff" testId="vault-futurecast-staff-notes">
      {hydrating && !data ? <NoteSkeletonGrid /> : null}

      {!hydrating && !data && (timedOut || offline) ? (
        <UiError
          title={offline ? 'FutureCast temporarily offline' : 'FutureCast unavailable — retry'}
          message={
            offline
              ? 'Staff notes could not be loaded from the API.'
              : 'Staff notes did not load within 2.5 seconds.'
          }
          retry={() => void load(false)}
          backHref="/vault/futurecast"
          backLabel="← FutureCast"
        />
      ) : null}

      {!hydrating && !data && !timedOut && !offline ? (
        <UiError
          title="FutureCast unavailable — retry"
          message="Could not load staff notes."
          retry={() => void load(false)}
          backHref="/vault/futurecast"
          backLabel="← FutureCast"
        />
      ) : null}

      {data ? <StaffNotesContent data={data} fromCache={fromCache} /> : null}
    </FutureCastElitePageShell>
  );
}

export default function FutureCastStaffNotesPage(): React.ReactElement {
  return (
    <Suspense fallback={<NoteSkeletonGrid />}>
      <FutureCastStaffNotesPageInner />
    </Suspense>
  );
}
