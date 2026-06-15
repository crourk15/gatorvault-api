'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { StaffNotesLayout } from '@/components/futurecast/StaffNotesLayout';
import { UiError } from '@/components/site/UiMessage';
import { fetchFutureCastStaffNotesBoard } from '@/lib/futurecast-board-api';
import type { StaffNotesResponse } from '@/lib/futurecast-board-types';

export function StaffNotesPageContent(): React.ReactElement {
  const [data, setData] = useState<StaffNotesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchFutureCastStaffNotesBoard());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staff notes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="fc-elite-loading">Loading staff notes…</p>;
  if (error) return <UiError message={error} />;
  if (!data) return <p className="fc-elite-empty">No staff notes.</p>;

  return (
    <StaffNotesLayout
      notes={data.notes}
      updatedAt={data.updatedAt}
      totalNotes={data.totalNotes ?? data.count}
    />
  );
}
