'use client';

import React from 'react';
import { FutureCastSubNav } from '@/components/site/FutureCastSubNav';
import { FutureCastHomepage } from '@/components/futurecast/FutureCastHomepage';
import '@/lib/futurecast.css';

export default function FutureCastPage(): React.ReactElement {
  return (
    <div className="fc-futurecast-page" data-testid="futurecast-page">
      <FutureCastSubNav active="home" />
      <div className="gv-page-hero">
        <h1 className="gv-page-title">FutureCast</h1>
        <p className="gv-page-subtitle">
          2027 recruiting cycle — commits, targets, movement, and portal intel.
        </p>
      </div>
      <FutureCastHomepage />
    </div>
  );
}
