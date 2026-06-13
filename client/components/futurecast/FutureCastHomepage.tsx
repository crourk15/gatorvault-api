'use client';

/**
 * FutureCast homepage — grouped 2027 cycle sections.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FutureCastHomeCard } from '@/components/futurecast/FutureCastHomeCard';
import { MovementHeatmap } from '@/components/futurecast/MovementHeatmap';
import { PortalWatchlistCard } from '@/components/futurecast/PortalWatchlistCard';
import {
  fetchFutureCastHome,
  type CommitSort,
  type FutureCastHomeResponse,
} from '@/lib/futurecast-home-api';
import type { FeedPrediction } from '@/lib/predictions-api';
import { UiEmpty, UiError } from '@/components/site/UiMessage';
import { usePathname } from '@/lib/use-pathname';
import { isVaultPath, vaultFutureCastBackHref } from '@/lib/vault-routes';

const REFRESH_MS = 60_000;

function Section({
  title,
  subtitle,
  children,
  testId,
  actions,
  count,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  testId?: string;
  actions?: React.ReactNode;
  count?: number;
}): React.ReactElement {
  return (
    <section className="fc-home-section" data-testid={testId}>
      <div className="fc-home-section__header">
        <div className="fc-home-section__heading">
          <h2 className="fc-home-section__title">{title}</h2>
          {count != null && <span className="fc-home-section__count">{count}</span>}
          {subtitle && <p className="fc-home-section__subtitle">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div className="fc-home-section__body">{children}</div>
    </section>
  );
}

function EmptySection({ message }: { message: string }): React.ReactElement {
  return <p className="fc-home-section__empty">{message}</p>;
}

function CardGrid({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="fc-home-card-grid">{children}</div>;
}

function movementDirection(p: FeedPrediction): 'up' | 'down' | 'flat' {
  const d = p.delta ?? 0;
  if (d > 0) return 'up';
  if (d < 0) return 'down';
  return 'flat';
}

export function FutureCastHomepage(): React.ReactElement {
  const pathname = usePathname();
  const backHref = vaultFutureCastBackHref(pathname);
  const backLabel = isVaultPath(pathname) ? '← Vault Dashboard' : '← GatorVault Home';
  const [data, setData] = useState<FutureCastHomeResponse | null>(null);
  const [commitSort, setCommitSort] = useState<CommitSort>('fit');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    }
    try {
      const next = await fetchFutureCastHome(commitSort);
      setData(next);
      setError(null);
    } catch (err) {
      if (isInitial) {
        setError(err instanceof Error ? err.message : 'Failed to load FutureCast.');
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [commitSort]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function run(isInitial: boolean) {
      if (cancelled) return;
      await load(isInitial);
    }

    void run(true);
    timer = setInterval(() => void run(false), REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [load]);

  const trendingUp = useMemo(
    () => (data?.trendingUp ?? []).filter((p) => (p.delta ?? 0) > 0),
    [data?.trendingUp]
  );
  const trendingDown = useMemo(
    () => (data?.trendingDown ?? []).filter((p) => (p.delta ?? 0) < 0),
    [data?.trendingDown]
  );

  if (loading && !data) {
    return <p className="fc-profile-empty">Loading FutureCast…</p>;
  }

  if (error && !data) {
    return (
      <UiError
        title="FutureCast unavailable"
        message={error}
        retry={() => void load(true)}
        backHref={backHref}
        backLabel={backLabel}
      />
    );
  }

  if (!data) {
    return <UiEmpty message="No FutureCast data available right now." hint="Check back after the next model refresh." />;
  }

  const sortActions = (
    <div className="fc-home-sort">
      <button
        type="button"
        className={`fc-home-sort__btn${commitSort === 'fit' ? ' is-active' : ''}`}
        onClick={() => setCommitSort('fit')}
      >
        Fit Score
      </button>
      <button
        type="button"
        className={`fc-home-sort__btn${commitSort === 'stability' ? ' is-active' : ''}`}
        onClick={() => setCommitSort('stability')}
      >
        Stability
      </button>
    </div>
  );

  return (
    <div className="fc-home" data-testid="futurecast-home">
      <Section
        title="Movement Heatmap"
        subtitle={`${data.heatmap.windowDays}-day MODEL confidence shifts`}
        testId="home-heatmap"
      >
        <MovementHeatmap buckets={data.heatmap.buckets} windowDays={data.heatmap.windowDays} />
      </Section>

      <Section
        title={`UF Commits — ${data.classYear} Class`}
        subtitle={
          data.commitTotal != null && data.commitTotal > data.commits.length
            ? `Showing ${data.commits.length} of ${data.commitTotal} commits — full list in Recruiting Hub`
            : 'Signed prospects sorted by Fit Score or Stability'
        }
        testId="home-commits"
        count={data.commitTotal ?? data.commits.length}
        actions={sortActions}
      >
        {data.commits.length > 0 ? (
          <>
            <CardGrid>
              {data.commits.map((p) => (
                <FutureCastHomeCard key={p.playerId} prediction={p} variant="commit" />
              ))}
            </CardGrid>
            {isVaultPath(pathname) && (
              <p className="fc-home-section__footer-link">
                <a href="/vault/recruiting">View Recruiting Hub →</a>
              </p>
            )}
          </>
        ) : (
          <EmptySection message={`No ${data.classYear} commits in FutureCast yet.`} />
        )}
      </Section>

      <Section
        title="Top Targets"
        subtitle="Uncommitted prospects sorted by UF Probability"
        testId="home-targets"
        count={data.topTargets.length}
      >
        {data.topTargets.length > 0 ? (
          <CardGrid>
            {data.topTargets.map((p) => (
              <FutureCastHomeCard key={p.playerId} prediction={p} variant="target" />
            ))}
          </CardGrid>
        ) : (
          <EmptySection message="No top targets match current filters." />
        )}
      </Section>

      <Section
        title="Trending Up"
        subtitle="Rising prospects — MODEL delta + recent signals (visits, buzz, staff flags)"
        testId="home-trending-up"
        count={trendingUp.length}
      >
        {trendingUp.length > 0 ? (
          <CardGrid>
            {trendingUp.map((p) => (
              <FutureCastHomeCard
                key={p.playerId}
                prediction={p}
                variant={movementDirection(p) === 'down' ? 'trending-down' : 'trending-up'}
              />
            ))}
          </CardGrid>
        ) : (
          <EmptySection message="No risers in the current window." />
        )}
      </Section>

      <Section
        title="Trending Down"
        subtitle="Cooling prospects — negative MODEL delta and fading signals"
        testId="home-trending-down"
        count={trendingDown.length}
      >
        {trendingDown.length > 0 ? (
          <CardGrid>
            {trendingDown.map((p) => (
              <FutureCastHomeCard
                key={p.playerId}
                prediction={p}
                variant="trending-down"
              />
            ))}
          </CardGrid>
        ) : (
          <EmptySection message="No fallers in the current window." />
        )}
      </Section>

      <Section
        title="Portal Watchlist"
        subtitle={`${data.classYear} portal candidates — college & transfer targets only`}
        testId="home-portal"
        count={data.portalWatchlist.length}
      >
        {data.portalWatchlist.length > 0 ? (
          <div className="fc-portal-grid fc-home-portal-grid">
            {data.portalWatchlist.map((p) => (
              <PortalWatchlistCard key={p.id} player={p} />
            ))}
          </div>
        ) : (
          <EmptySection message="No portal candidates on the watchlist." />
        )}
      </Section>
    </div>
  );
}
