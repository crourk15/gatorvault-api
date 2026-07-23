'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  ACTIVE_RECRUITING_CLASS_YEAR,
  parseRecruitingClassYear,
  type RecruitingClassYear,
} from '@/lib/recruiting-cycle';

let storeYear: RecruitingClassYear = ACTIVE_RECRUITING_CLASS_YEAR;
/** Once the user picks a class year, seeds/providers must not snap it back. */
let userPinned = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getRecruitingClassYearSnapshot(): RecruitingClassYear {
  return storeYear;
}

export function isRecruitingClassYearUserPinned(): boolean {
  return userPinned;
}

type SetYearOptions = {
  /** true = user gesture (tabs/cards). Seeds/providers omit this. */
  pin?: boolean;
};

export function setRecruitingClassYearStore(year: number, opts?: SetYearOptions): void {
  const next = parseRecruitingClassYear(year);
  if (opts?.pin) userPinned = true;
  // Ignore passive seeds after the user has chosen a year (fixes 2027↔2028 hop).
  if (!opts?.pin && userPinned) return;
  if (next === storeYear) return;
  storeYear = next;
  emit();
}

export function subscribeRecruitingClassYear(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

/** Test helper — reset module store between cases. */
export function __resetRecruitingClassYearStoreForTests(): void {
  storeYear = ACTIVE_RECRUITING_CLASS_YEAR;
  userPinned = false;
  emit();
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
    setRecruitingClassYearStore(year, { pin: true });
  }, []);
  return { activeYear, setActiveYear };
}
