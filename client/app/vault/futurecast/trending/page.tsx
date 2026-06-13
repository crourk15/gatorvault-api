'use client';

import React from 'react';
import { FutureCastSubNav } from '@/components/site/FutureCastSubNav';
import { FutureCastHomepage } from '@/components/futurecast/FutureCastHomepage';
import '@/lib/futurecast.css';

export default function VaultFutureCastTrendingPage(): React.ReactElement {
  return (
    <div className="fc-futurecast-page" data-testid="vault-futurecast-trending">
      <FutureCastSubNav active="trending" />
      <div className="gv-page-hero">
        <h1 className="gv-page-title">FutureCast Trending Board</h1>
        <p className="gv-page-subtitle">
          Rising and cooling prospects — MODEL delta + visit intel + staff signals.
        </p>
      </div>
      <FutureCastHomepage mode="trending" />
    </div>
  );
}
