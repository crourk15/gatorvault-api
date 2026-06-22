'use client';

import React from 'react';
import { RecruitingHubElite } from '@/components/recruiting-hub/elite/RecruitingHubElite';

type Props = {
  deferHero?: boolean;
};

/** Client-only hub sections (hero may be SSR-deferred). */
export function RecruitingHubCommandCenterClient({ deferHero = false }: Props): React.ReactElement {
  return <RecruitingHubElite deferHero={deferHero} embedded />;
}
