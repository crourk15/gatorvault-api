'use client';

import React from 'react';
import { ScoutingDepartmentPage } from '@/components/site/ScoutingDepartmentPage';
import { PublicSiteShell } from '@/components/site/PublicSiteShell';

export default function ScoutingReportsRoute(): React.ReactElement {
  return (
    <PublicSiteShell>
      <ScoutingDepartmentPage initialView="reports" />
    </PublicSiteShell>
  );
}
