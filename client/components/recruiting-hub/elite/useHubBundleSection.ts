'use client';

import { useEffect, useRef, useState } from 'react';
import type { RhHubBundle } from '@/lib/recruiting-hub-elite-api';
import { useRecruitingHubBundleContext } from '@/components/recruiting-hub/elite/RecruitingHubBundleContext';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';

/**
 * Prefer hub bundle data (single /hub/bundle request). Fall back to a section fetch
 * only when the bundle is unavailable or still loading after failure.
 *
 * Pass `year` when a section (e.g. footprint map tabs) reads a class year that may
 * differ from the hub shell year — otherwise the active hub year is used.
 */
export function useHubBundleSection<T>({
  select,
  fetchFallback,
  year,
}: {
  select: (bundle: RhHubBundle) => T;
  fetchFallback: (year: number) => Promise<T>;
  year?: number;
}): { data: T | null; loading: boolean; error: boolean } {
  const { data: bundle, loading: bundleLoading, error: bundleError } = useRecruitingHubBundleContext();
  const { activeYear } = useRecruitingClassYear();
  const sectionYear = year ?? activeYear;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const selectRef = useRef(select);
  const fetchRef = useRef(fetchFallback);
  selectRef.current = select;
  fetchRef.current = fetchFallback;

  const bundleMatchesYear = bundle != null && bundle.year === sectionYear;

  useEffect(() => {
    if (bundleMatchesYear) {
      setData(selectRef.current(bundle));
      setLoading(false);
      setError(false);
      return;
    }

    // Only wait on the hub bundle when this section is tied to the shell year.
    // Divergent years (footprint 2028 while hub is 2027) must fetch immediately.
    if (bundleLoading && sectionYear === activeYear) {
      setLoading(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);
    void fetchRef
      .current(sectionYear)
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
  }, [activeYear, sectionYear, bundle, bundleLoading, bundleMatchesYear, bundleError]);

  return {
    data,
    loading: bundleLoading && sectionYear === activeYear && !bundleMatchesYear ? true : loading,
    error: bundleError && sectionYear === activeYear && !bundleMatchesYear ? true : error,
  };
}