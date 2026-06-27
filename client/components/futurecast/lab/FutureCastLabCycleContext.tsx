'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { primaryRecruitingClassYear } from '@/lib/recruiting-cycle';

export type FutureCastLabCycle = 2027 | 2028;

type FutureCastLabCycleContextValue = {
  cycle: FutureCastLabCycle;
  setCycle: (cycle: FutureCastLabCycle) => void;
  discoveryView: boolean;
  defaultCycle: FutureCastLabCycle;
};

const FutureCastLabCycleContext = createContext<FutureCastLabCycleContextValue | null>(null);

function defaultCycle(): FutureCastLabCycle {
  const year = primaryRecruitingClassYear();
  return year === 2028 ? 2028 : 2027;
}

export function FutureCastLabCycleProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const defaultYear = useMemo(() => defaultCycle(), []);
  const [cycle, setCycleState] = useState<FutureCastLabCycle>(defaultYear);

  const setCycle = useCallback((next: FutureCastLabCycle) => {
    setCycleState(next);
  }, []);

  const value = useMemo(
    () => ({
      cycle,
      setCycle,
      discoveryView: cycle === 2028,
      defaultCycle: defaultYear,
    }),
    [cycle, setCycle, defaultYear]
  );

  return <FutureCastLabCycleContext.Provider value={value}>{children}</FutureCastLabCycleContext.Provider>;
}

export function useFutureCastLabCycle(): FutureCastLabCycleContextValue {
  const ctx = useContext(FutureCastLabCycleContext);
  if (!ctx) {
    const year = defaultCycle();
    return {
      cycle: year,
      setCycle: () => undefined,
      discoveryView: year === 2028,
      defaultCycle: year,
    };
  }
  return ctx;
}
