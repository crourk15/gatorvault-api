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
import { NilPortalImpact } from '@/components/nil/NilPortalImpact';
import { NilFooterCta } from '@/components/nil/NilFooterCta';
import { useNilEliteData } from '@/components/nil/useNilEliteData';
import { useIsCommandCenterDesktop } from '@/hooks/useIsCommandCenterDesktop';

export function NilElitePage(): React.ReactElement {
  const isDesktop = useIsCommandCenterDesktop();
  const { dashboard, players, portalGains, portalLosses, loading, error, reload } = useNilEliteData();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    void reload().finally(() => setRefreshing(false));
  };

  return (
    <div className="rh-page rh-page--elite gv-nil-page mobile-app" data-testid="vault-nil">
      {!isDesktop ? <NilMobileHeader /> : null}

      {loading && !dashboard ? (
        <div className="rh-cc-page rh-frame" aria-busy="true" data-testid="nil-elite-loading">
          <div className="rh-cc-skeleton" style={{ minHeight: 140, borderRadius: 12 }} />
          <div className="rh-cc-skeleton" style={{ minHeight: 88, borderRadius: 12, marginTop: 16 }} />
          <div className="rh-cc-skeleton" style={{ minHeight: 220, borderRadius: 12, marginTop: 16 }} />
        </div>
      ) : null}

      {error && !dashboard ? (
        <div className="rh-frame">
          <UiError message={error} retry={() => void reload()} backHref="/vault" backLabel="← Home" />
        </div>
      ) : null}

      {dashboard ? (
        <div className="rh-cc-page nil-cc-page">
          <NilHero dashboard={dashboard} />
          <NilMetricsBar dashboard={dashboard} />

          <div className="rh-cc-main rh-frame">
            <div className="rh-cc-col">
              <NilLeaderboard players={players} />
              <NilMovementFeed dashboard={dashboard} players={players} />
              <NilCollectiveComparison dashboard={dashboard} />
              <NilPortalImpact gains={portalGains} losses={portalLosses} />
              <NilFooterCta onRefresh={handleRefresh} refreshing={refreshing || loading} />
            </div>
          </div>

          <p className="nil-disclaimer rh-frame">
            NIL estimates are directional — not audited financials. Rankings reflect modeled collective activity and
            public signals.
          </p>
        </div>
      ) : null}
    </div>
  );
}
