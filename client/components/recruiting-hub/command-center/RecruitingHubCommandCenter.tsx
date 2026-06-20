'use client';

import React from 'react';
import { RecruitingHubElite } from '@/components/recruiting-hub/elite/RecruitingHubElite';

/** Recruiting Hub command center — War Room elite vertical chrome. */
export function RecruitingHubCommandCenter(): React.ReactElement {
  return (
    <div className="rh-cc-page" data-testid="rh-command-center">
      <RecruitingHubElite />
    </div>
  );
}
