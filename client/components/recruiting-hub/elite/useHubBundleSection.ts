'use client';

import { useEffect, useRef, useState } from 'react';
import type { RhHubBundle } from '@/lib/recruiting-hub-elite-api';
import { useRecruitingHubBundleContext } from '@/components/recruiting-hub/elite/RecruitingHubBundleContext';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';

/**
 * Prefer hub bundle data (single /hub/bundle request). Fall back to a section fetch
 * only when the bundle is unavailable or still loading after failure.
 */
export function useHubBundleSection<T>({
  select,
  fetchFallback,
}: {
  select: (bundle: RhHubBundle) => T;
  fetchFallback: (year: number) => Promise<T>;
}): { data: T | null; loading: boolean; error: boolean } {
  const { data: bundle, loading: bundleLoading, error: bundleError } = useRecruitingHubBundleContext();
  const { activeYear } = useRecruitingClassYear();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const selectRef = useRef(select);
  const fetchRef = useRef(fetchFallback);
  selectRef.current = select;
  fetchRef.current = fetchFallback;

  const bundleMatchesYear = bundle != null && bundle.year === activeYear;

  useEffect(() => {
    if (bundleMatchesYear) {
      setData(selectRef.current(bundle));
      setLoading(false);
      setError(false);
      return;
    }

    if (bundleLoading) {
      setLoading(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);
    void fetchRef
      .current(activeYear)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeYear, bundle, bundleLoading, bundleMatchesYear, bundleError]);

  return {
    data,
    loading: bundleLoading && !bundleMatchesYear ? true : loading,
    error: bundleError && !bundleMatchesYear ? true : error,
  };
}