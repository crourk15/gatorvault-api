'use client';

/**
 * FutureCast homepage — grouped 2027 cycle sections.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FutureCastHomeCard } from '@/components/futurecast/FutureCastHomeCard';
import { MovementHeatmap } from '@/components/futurecast/MovementHeatmap';
import {
  fetchFutureCastHome,
  type CommitSort,
  type FutureCastHomeResponse,
  type PortalWatchlistHomePlayer,
} from '@/lib/futurecast-home-api';
import { portalLikelihoodBand } from '@/lib/portal-api';

const REFRESH_MS = 60_000;

function Section({
  title,
  subtitle,
  children,
  testId,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  testId?: string;
  actions?: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="fc-home-section" data-testid={testId}>
      <div className="fc-home-section__header">
        <div>
          <h2 className="fc-home-section__title">{title}</h2>
          {subtitle && <p className="fc-home-section__subtitle">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function EmptySection({ message }: { message: string }): React.ReactElement {
  return <p className="fc-home-section__empty">{message}</p>;
}

function PortalCard({ player }: { player: PortalWatchlistHomePlayer }): React.ReactElement {
  const band = portalLikelihoodBand(player.portalLikelihood);
  return (
    <a href={`/player/${player.slug}?tab=portal`} className="fc-portal-card fc-home-portal-card">
      <span className="fc-portal-card__rank">#{player.rank}</span>
      <h3 className="fc-portal-card__name">{player.fullName}</h3>
      <p className="fc-portal-card__meta">
        {player.position} · {player.classYear}
      </p>
      <div className="fc-portal-card__scores">
        <span className={`fc-portal-badge fc-portal-badge--${band}`}>
          Portal {player.portalLikelihood}%
        </span>
        <span className="fc-portal-metric">Risk {player.depthChartRisk}</span>
      </div>
    </a>
  );
}

export function FutureCastHomepage(): React.ReactElement {
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

  if (loading && !data) {
    return <p className="fc-profile-empty">Loading FutureCast…</p>;
  }

  if (error && !data) {
    return <p className="fc-profile-error">{error}</p>;
  }

  if (!data) {
    return <p className="fc-profile-empty">No FutureCast data available.</p>;
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
        subtitle={`${data.heatmap.windowDays}-day MODEL confidence shifts · ${data.classYear} class only`}
        testId="home-heatmap"
      >
        <MovementHeatmap buckets={data.heatmap.buckets} windowDays={data.heatmap.windowDays} />
      </Section>

      <Section
        title={`UF Commits (${data.classYear})`}
        subtitle="Sorted by Fit Score or Stability"
        testId="home-commits"
        actions={sortActions}
      >
        {data.commits.length > 0 ? (
          <div className="fc-home-card-grid">
            {data.commits.map((p) => (
              <FutureCastHomeCard key={p.playerId} prediction={p} variant="commit" />
            ))}
          </div>
        ) : (
          <EmptySection message="No 2027 commits in FutureCast yet." />
        )}
      </Section>

      <Section
        title={`Top Targets (${data.classYear})`}
        subtitle="Uncommitted prospects — sorted by UF Probability"
        testId="home-targets"
      >
        {data.topTargets.length > 0 ? (
          <div className="fc-home-card-grid">
            {data.topTargets.map((p) => (
              <FutureCastHomeCard key={p.playerId} prediction={p} variant="target" />
            ))}
          </div>
        ) : (
          <EmptySection message="No top targets match current filters." />
        )}
      </Section>

      <Section
        title="Trending Up"
        subtitle="Biggest confidence gainers this week"
        testId="home-trending-up"
      >
        {data.trendingUp.length > 0 ? (
          <div className="fc-home-card-grid fc-home-card-grid--compact">
            {data.trendingUp.map((p) => (
              <FutureCastHomeCard key={p.playerId} prediction={p} variant="trending" />
            ))}
          </div>
        ) : (
          <EmptySection message="No risers in the current window." />
        )}
      </Section>

      <Section
        title="Trending Down"
        subtitle="Biggest confidence fallers this week"
        testId="home-trending-down"
      >
        {data.trendingDown.length > 0 ? (
          <div className="fc-home-card-grid fc-home-card-grid--compact">
            {data.trendingDown.map((p) => (
              <FutureCastHomeCard key={p.playerId} prediction={p} variant="trending" />
            ))}
          </div>
        ) : (
          <EmptySection message="No fallers in the current window." />
        )}
      </Section>

      <Section
        title="Portal Watchlist"
        subtitle={`${data.classYear} college players with elevated portal likelihood`}
        testId="home-portal"
      >
        {data.portalWatchlist.length > 0 ? (
          <div className="fc-portal-grid fc-home-portal-grid">
            {data.portalWatchlist.map((p) => (
              <PortalCard key={p.id} player={p} />
            ))}
          </div>
        ) : (
          <EmptySection message="No portal candidates on the watchlist." />
        )}
      </Section>
    </div>
  );
}
