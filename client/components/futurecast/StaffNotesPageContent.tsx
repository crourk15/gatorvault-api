'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { StaffNotesLayout } from '@/components/futurecast/StaffNotesLayout';
import { FutureCastSubPageLoading } from '@/components/futurecast/FutureCastSubPageLoading';
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

  if (loading) return <FutureCastSubPageLoading testId="fc-staff-notes-loading" />;
  if (error) return <UiError message={error} />;
  if (!data) return <p className="rh-cc-empty">No staff notes.</p>;

  return (
    <StaffNotesLayout
      notes={data.notes}
      updatedAt={data.updatedAt}
      totalNotes={data.totalNotes ?? data.count}
    />
  );
}
