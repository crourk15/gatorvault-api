'use client';

import React from 'react';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { DashboardMovementPreview } from '@/components/vault/dashboard/DashboardMovementPreview';
import { GNL_COPY } from '@/lib/gatornation-live-types';

type Props = {
  data: StaffDashboardResponse | null;
  loading?: boolean;
};

export function MovementIntelPreview({ data, loading }: Props): React.ReactElement {
  return (
    <div className="gv-gnl-movement" data-testid="gnl-movement-intel">
      <h2 className="gv-gnl__section-title">{GNL_COPY.movementIntel.title}</h2>
      <p className="gv-gnl__section-sub">{GNL_COPY.movementIntel.subtitle}</p>
      <DashboardMovementPreview data={data} loading={loading} />
    </div>
  );
}
