'use client';

import React from 'react';
import { FutureCastSubNav } from '@/components/site/FutureCastSubNav';
import { FutureCastHomepage } from '@/components/futurecast/FutureCastHomepage';
import '@/lib/futurecast.css';

export default function VaultFutureCastPage(): React.ReactElement {
  return (
    <div className="fc-futurecast-page" data-testid="vault-futurecast-page">
      <FutureCastSubNav active="master" />
      <div className="gv-page-hero">
        <h1 className="gv-page-title">FutureCast Master Board</h1>
        <p className="gv-page-subtitle">
          2027 cycle — commits, targets, heatmap, and high-priority intel.
        </p>
      </div>
      <FutureCastHomepage mode="master" />
    </div>
  );
}
