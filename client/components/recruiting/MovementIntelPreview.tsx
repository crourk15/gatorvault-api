'use client';

import React from 'react';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { DashboardMovementPreview } from '@/components/vault/dashboard/DashboardMovementPreview';

type Props = {
  data: StaffDashboardResponse | null;
  loading?: boolean;
};

export function MovementIntelPreview({ data, loading }: Props): React.ReactElement {
  return (
    <div className="gv-rh-movement-preview" data-testid="recruiting-movement-intel">
      <DashboardMovementPreview data={data} loading={loading} />
    </div>
  );
}
