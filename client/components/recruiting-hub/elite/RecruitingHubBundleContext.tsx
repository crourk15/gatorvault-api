'use client';

import React, { createContext, useContext } from 'react';
import type { RhHubBundle } from '@/lib/recruiting-hub-elite-api';

export type RecruitingHubBundleState = {
  data: RhHubBundle | null;
  loading: boolean;
  error: boolean;
};

const RecruitingHubBundleContext = createContext<RecruitingHubBundleState>({
  data: null,
  loading: true,
  error: false,
});

export function RecruitingHubBundleProvider({
  value,
  children,
}: {
  value: RecruitingHubBundleState;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <RecruitingHubBundleContext.Provider value={value}>{children}</RecruitingHubBundleContext.Provider>
  );
}

export function useRecruitingHubBundleContext(): RecruitingHubBundleState {
  return useContext(RecruitingHubBundleContext);
}
