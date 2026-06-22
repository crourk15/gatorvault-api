'use client';

import React, { useEffect } from 'react';
import { setRecruitingClassYearStore } from '@/lib/recruiting-class-year-store';

type Props = {
  initialYear?: number;
  children: React.ReactNode;
};

/** Sets route/default class year on mount — store syncs hero + hub sections. */
export function RecruitingClassYearProvider({ initialYear, children }: Props): React.ReactElement {
  useEffect(() => {
    if (initialYear != null) setRecruitingClassYearStore(initialYear);
  }, [initialYear]);

  return <>{children}</>;
}
