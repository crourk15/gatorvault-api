'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  ACTIVE_RECRUITING_CLASS_YEAR,
  parseRecruitingClassYear,
  type RecruitingClassYear,
} from '@/lib/recruiting-cycle';

let storeYear: RecruitingClassYear = ACTIVE_RECRUITING_CLASS_YEAR;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getRecruitingClassYearSnapshot(): RecruitingClassYear {
  return storeYear;
}

export function setRecruitingClassYearStore(year: number): void {
  const next = parseRecruitingClassYear(year);
  if (next === storeYear) return;
  storeYear = next;
  emit();
}

export function subscribeRecruitingClassYear(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

/** Shared class year — syncs hero hydration root and hub sections. */
export function useRecruitingClassYear(): {
  activeYear: RecruitingClassYear;
  setActiveYear: (year: RecruitingClassYear) => void;
} {
  const activeYear = useSyncExternalStore<RecruitingClassYear>(
    subscribeRecruitingClassYear,
    getRecruitingClassYearSnapshot,
    (): RecruitingClassYear => ACTIVE_RECRUITING_CLASS_YEAR
  );
  const setActiveYear = useCallback((year: RecruitingClassYear) => {
    setRecruitingClassYearStore(year);
  }, []);
  return { activeYear, setActiveYear };
}
