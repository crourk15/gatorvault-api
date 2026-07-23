'use client';

import React, { useState } from 'react';
import '@/lib/nil-elite.css';
import { UiError } from '@/components/site/UiMessage';
import { NilMobileHeader } from '@/components/nil/NilMobileHeader';
import { NilHero } from '@/components/nil/NilHero';
import { NilMetricsBar } from '@/components/nil/NilMetricsBar';
import { NilLeaderboard } from '@/components/nil/NilLeaderboard';
import { NilMovementFeed } from '@/components/nil/NilMovementFeed';
import { NilCollectiveComparison } from '@/components/nil/NilCollectiveComparison';
import { NilProgramRankingsTable } from '@/components/nil/NilProgramRankingsTable';
import { NilPortalImpact } from '@/components/nil/NilPortalImpact';
import { NilFooterCta } from '@/components/nil/NilFooterCta';
import { useNilEliteData } from '@/components/nil/useNilEliteData';
import { useIsCommandCenterDesktop } from '@/hooks/useIsCommandCenterDesktop';

export function NilElitePage(): React.ReactElement {
  const isDesktop = useIsCommandCenterDesktop();
  const { bundle, loading, error, reload } = useNilEliteData();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    void reload().finally(() => setRefreshing(false));
  };

  return (
    <div className="rh-page rh-page--elite gv-nil-page mobile-app" data-testid="vault-nil">
      {!isDesktop ? <NilMobileHeader /> : null}

      {loading && !bundle ? (
        <div className="rh-cc-page rh-frame" aria-busy="true" data-testid="nil-elite-loading">
          <div className="rh-cc-skeleton" style={{ minHeight: 140, borderRadius: 12 }} />
          <div className="rh-cc-skeleton" style={{ minHeight: 88, borderRadius: 12, marginTop: 16 }} />
          <div className="rh-cc-skeleton" style={{ minHeight: 220, borderRadius: 12, marginTop: 16 }} />
        </div>
      ) : null}

      {error && !bundle ? (
        <div className="rh-frame">
          <UiError message={error} retry={() => void reload()} backHref="/vault" backLabel="← Home" />
        </div>
      ) : null}

      {bundle ? (
        <div className="rh-cc-page nil-cc-page">
          <NilHero hero={bundle.hero} pulse={bundle.pulse} />
          <NilMetricsBar pulse={bundle.pulse} classYear={bundle.classYear} />

          <div className="rh-cc-main rh-frame">
            <div className="rh-cc-col">
              <NilLeaderboard marketBoard={bundle.marketBoard} />
              <NilPortalImpact portal={bundle.portal} />
              <NilMovementFeed items={bundle.movement} />
              <NilCollectiveComparison collectives={bundle.collectives} />
              {bundle.editorial ? <NilProgramRankingsTable editorial={bundle.editorial} /> : null}
              <NilFooterCta onRefresh={handleRefresh} refreshing={refreshing || loading} />
            </div>
          </div>

          <p className="nil-disclaimer rh-frame">
            Elite NIL rule: only proven board, roster, portal, and collective signals. Dollar figures appear
            only from On3 when public — never invented deal ranges.
          </p>
        </div>
      ) : null}
    </div>
  );
}
