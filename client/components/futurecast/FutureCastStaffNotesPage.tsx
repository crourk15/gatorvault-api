'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FutureCastSubNav } from '@/components/site/FutureCastSubNav';
import { fetchWarRoomBreakdowns, type WarRoomBreakdown } from '@/lib/war-room-api';
import { playerProfilePath } from '@/lib/player-routes';
import { UiEmpty, UiError } from '@/components/site/UiMessage';
import '@/lib/futurecast.css';

/** 2026 UF commit slugs — excluded from Staff Notes (cycle closed). */
const EXCLUDED_2026_SLUGS = new Set([
  'davian-groce', 'cj-bronaugh', 'kevin-ford', 'justin-williams', 'jareylan-mccoy',
  'dylan-purter', 'will-griffin', 'kendall-guervil', 'tyler-chukuyem', 'malik-morris',
  'heze-kent', 'marquez-daniel', 'kaiden-hall', 'duke-clark', 'gnivre-carr',
  'corey-brown', 'desmond-green', 'javarii-luckas', 'micah-jones', 'byron-louis',
  'jalen-wiggins', 'jaylen-jordan', 'ace-ciongoli',
]);

function isExcluded2026(b: WarRoomBreakdown): boolean {
  if (EXCLUDED_2026_SLUGS.has(b.playerSlug)) return true;
  const story = `${b.recruitingStory ?? ''} ${b.projection ?? ''}`.toLowerCase();
  if (/\b2026\b/.test(story) && !/\b2027\b/.test(story)) return true;
  return false;
}

function BreakdownCard({ entry }: { entry: WarRoomBreakdown }): React.ReactElement {
  const href = playerProfilePath(entry.playerSlug, 'HIGH_SCHOOL', true, entry.playerName, 'futurecast');
  const note = entry.insiderNotes || entry.staffNotes || entry.projection || entry.recruitingStory;

  return (
    <a href={href} className="fc-staff-note-card">
      <h3 className="fc-staff-note-card__name">{entry.playerName}</h3>
      {entry.projection && <p className="fc-staff-note-card__projection">{entry.projection}</p>}
      {note && (
        <p className="fc-staff-note-card__note">
          {String(note).length > 280 ? `${String(note).slice(0, 280)}…` : note}
        </p>
      )}
      {entry.comparison && (
        <p className="fc-staff-note-card__comp">Comp: {entry.comparison}</p>
      )}
    </a>
  );
}

export default function FutureCastStaffNotesPage(): React.ReactElement {
  const [notes, setNotes] = useState<WarRoomBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await fetchWarRoomBreakdowns();
      setNotes(all.filter((b) => !isExcluded2026(b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load staff notes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="fc-futurecast-page" data-testid="vault-futurecast-staff-notes">
      <FutureCastSubNav />
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Staff Notes</h1>
        <p className="gv-page-subtitle">
          Insider evaluations for 2027+ targets — 2026 cycle notes removed.
        </p>
      </div>

      {loading && <p className="fc-staff-dashboard__status">Loading staff notes…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load()} backHref="/vault/futurecast" backLabel="← FutureCast" />
      )}

      {!loading && !error && (
        <div className="fc-staff-notes-grid">
          {notes.map((entry) => (
            <BreakdownCard key={entry.playerSlug} entry={entry} />
          ))}
          {notes.length === 0 && <UiEmpty message="No staff notes for the current cycle." />}
        </div>
      )}
    </div>
  );
}
