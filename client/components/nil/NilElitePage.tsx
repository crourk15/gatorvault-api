'use client';

import React, { useState } from 'react';
import '@/lib/nil-elite.css';
import { UiError } from '@/components/site/UiMessage';
import { NilHero } from '@/components/nil/NilHero';
import { NilRosterEarners } from '@/components/nil/NilRosterEarners';
import { NilLeaderboard } from '@/components/nil/NilLeaderboard';
import { NilProgramRankingsTable } from '@/components/nil/NilProgramRankingsTable';
import { useNilEliteData } from '@/components/nil/useNilEliteData';

export function NilElitePage(): React.ReactElement {
  const { bundle, loading, error, reload } = useNilEliteData();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    void reload().finally(() => setRefreshing(false));
  };

  const landscape = bundle?.landscape || (
    bundle?.editorial
      ? {
          asOf: bundle.editorial.asOf,
          sourceNote: 'Estimated annual pools from public reporting — updated quarterly',
          disclaimer: bundle.editorial.disclaimer,
          uf: bundle.editorial.uf ? { ...bundle.editorial.uf } : null,
          sec: bundle.editorial.sec || [],
        }
      : null
  );

  return (
    <div className="rh-page rh-page--elite gv-nil-page mobile-app" data-testid="vault-nil">
      {loading && !bundle ? (
        <div className="rh-cc-page rh-frame" aria-busy="true" data-testid="nil-elite-loading">
          <div className="rh-cc-skeleton" style={{ minHeight: 280, borderRadius: 16 }} />
          <div className="rh-cc-skeleton" style={{ minHeight: 180, borderRadius: 12, marginTop: 16 }} />
        </div>
      ) : null}

      {error && !bundle ? (
        <div className="rh-frame">
          <UiError message={error} retry={() => void reload()} backHref="/vault" backLabel="← Home" />
        </div>
      ) : null}

      {bundle ? (
        <div className="rh-cc-page nil-cc-page">
          <NilHero
            hero={bundle.hero}
            money={bundle.money}
            desk={bundle.desk}
            topEarners={bundle.rosterEarners || []}
          />

          <div className="rh-cc-main rh-frame">
            <div className="rh-cc-col">
              <NilRosterEarners earners={bundle.rosterEarners || []} startRank={1} />
              {landscape ? <NilProgramRankingsTable landscape={landscape} /> : null}
              <NilLeaderboard marketBoard={bundle.marketBoard} />

              <div className="nil-desk-foot">
                <p className="nil-desk-foot__meta">
                  {bundle.desk?.provider || 'Sideline NIL Market Index'}
                  {bundle.generatedAt
                    ? ` · Updated ${new Date(bundle.generatedAt).toLocaleString()}`
                    : ''}
                </p>
                <button
                  type="button"
                  className="nil-editorial-toggle"
                  onClick={handleRefresh}
                  disabled={refreshing || loading}
                >
                  {refreshing || loading ? 'Refreshing…' : 'Refresh desk'}
                </button>
              </div>
            </div>
          </div>

          <p className="nil-disclaimer rh-frame">
            $ school markets are all-sport Sideline estimates. Football is broken out separately.
            Player dollars labeled On3 or Sideline model. Not audited contracts.
          </p>
        </div>
      ) : null}
    </div>
  );
}
