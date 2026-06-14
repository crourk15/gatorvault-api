'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ConfidenceBar } from '@/components/futurecast/ConfidenceBar';
import { TrendingIndicator } from '@/components/futurecast/TrendingIndicator';
import {
  fetchFutureCastClass,
  fetchFutureCastHome,
  fetchFutureCastPredictions,
  type FeedPredictionWithHistory,
  type FutureCastClassResponse,
  type FutureCastHomeResponse,
  type FutureCastPredictionsResponse,
  type TrendHistoryPoint,
} from '@/lib/futurecast-home-api';

const REFRESH_MS = 60_000;
const CLASS_YEAR = 2027;

function formatScore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value >= 10 ? value.toFixed(1) : `${Math.round(value)}`;
}

function TrendSparkline({ points }: { points: TrendHistoryPoint[] }): React.ReactElement | null {
  if (!points.length) return null;
  const vals = points.map((p) => p.confidence);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 72;
  const h = 22;
  const coords = vals
    .map((v, i) => {
      const x = vals.length === 1 ? w / 2 : (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      className="gv-landing-fc-widget__sparkline"
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      aria-hidden
    >
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={coords} />
    </svg>
  );
}

function WidgetSkeleton(): React.ReactElement {
  return (
    <div className="gv-landing-fc-widget gv-landing-fc-widget--loading" data-testid="fc-widget-skeleton">
      <div className="gv-landing-fc-widget__head">
        <div className="gv-landing-fc-widget__skeleton gv-landing-fc-widget__skeleton--title" />
        <div className="gv-landing-fc-widget__skeleton gv-landing-fc-widget__skeleton--badge" />
      </div>
      <div className="gv-landing-fc-widget__impact-row">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="gv-landing-fc-widget__skeleton gv-landing-fc-widget__skeleton--stat" />
        ))}
      </div>
      <div className="gv-landing-fc-widget__heat">
        {[1, 2, 3].map((i) => (
          <div key={i} className="gv-landing-fc-widget__skeleton gv-landing-fc-widget__skeleton--heat" />
        ))}
      </div>
      <div className="gv-landing-fc-widget__panels">
        {[1, 2, 3].map((i) => (
          <div key={i} className="gv-landing-fc-widget__skeleton gv-landing-fc-widget__skeleton--panel" />
        ))}
      </div>
    </div>
  );
}

function PickRow({ pick }: { pick: FeedPredictionWithHistory }): React.ReactElement {
  return (
    <div className="gv-landing-fc-widget__pick">
      <div className="gv-landing-fc-widget__pick-head">
        <span className="gv-landing-fc-widget__pick-name">{pick.fullName}</span>
        <TrendingIndicator delta={pick.delta ?? 0} />
      </div>
      <div className="gv-landing-fc-widget__pick-meta">
        <span>{pick.position}</span>
        <span>{Math.round(pick.confidence)}% UF</span>
      </div>
      <ConfidenceBar value={pick.confidence} />
      {pick.trendHistory && pick.trendHistory.length > 1 ? (
        <TrendSparkline points={pick.trendHistory} />
      ) : null}
    </div>
  );
}

class FutureCastWidgetErrorBoundary extends React.Component<
  { children: React.ReactNode; onRetry?: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="gv-landing-fc-widget gv-landing-fc-widget--error" role="alert">
          <p>FutureCast preview unavailable.</p>
          <p className="gv-landing-fc-widget__error-detail">{this.state.error.message}</p>
          <button
            type="button"
            className="gv-landing-fc-widget__retry"
            onClick={() => {
              this.setState({ error: null });
              this.props.onRetry?.();
            }}
          >
            Retry
          </button>
          <a href="/futurecast" className="gv-landing-fc-widget__cta-link">
            Open FutureCast →
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}

function HomepageFutureCastWidgetInner(): React.ReactElement {
  const [home, setHome] = useState<FutureCastHomeResponse | null>(null);
  const [classData, setClassData] = useState<FutureCastClassResponse | null>(null);
  const [predictions, setPredictions] = useState<FutureCastPredictionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    }
    try {
      const [homeRes, classRes, predRes] = await Promise.all([
        fetchFutureCastHome('fit'),
        fetchFutureCastClass(CLASS_YEAR),
        fetchFutureCastPredictions(CLASS_YEAR, 4),
      ]);
      setHome(homeRes);
      setClassData(classRes);
      setPredictions(predRes);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      if (isInitial) {
        setError(err instanceof Error ? err.message : 'Failed to load FutureCast.');
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

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

  if (loading && !home) {
    return <WidgetSkeleton />;
  }

  if (error && !home) {
    return (
      <div className="gv-landing-fc-widget gv-landing-fc-widget--error" role="alert">
        <p>FutureCast preview unavailable.</p>
        <p className="gv-landing-fc-widget__error-detail">{error}</p>
        <button type="button" className="gv-landing-fc-widget__retry" onClick={() => void load(true)}>
          Retry
        </button>
        <a href="/futurecast" className="gv-landing-fc-widget__cta-link">
          Open FutureCast →
        </a>
      </div>
    );
  }

  const buckets = home?.heatmap?.buckets ?? [];
  const up = buckets.find((b) => /up/i.test(b.label))?.count ?? 0;
  const down = buckets.find((b) => /down/i.test(b.label))?.count ?? 0;
  const flat = buckets.find((b) => /flat/i.test(b.label))?.count ?? 0;
  const topTarget = home?.topTargets?.[0];
  const latestCommit = home?.commits?.[0];
  const portalPick = home?.portalWatchlist?.[0];
  const featuredPick = predictions?.predictions?.[0] ?? null;

  return (
    <div className="gv-landing-fc-widget" data-testid="homepage-fc-widget">
      <div className="gv-landing-fc-widget__head">
        <div>
          <h3>Live Preview</h3>
          <span className="gv-landing-fc-widget__live">
            <span className="gv-landing-pulse" aria-hidden />
            Live · {CLASS_YEAR} cycle
          </span>
        </div>
        {lastRefresh ? (
          <span className="gv-landing-fc-widget__refresh" title="Auto-refreshes every minute">
            Updated {lastRefresh.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
        ) : null}
      </div>

      <div className="gv-landing-fc-widget__impact-row">
        <div className="gv-landing-fc-widget__impact">
          <p>Class Impact</p>
          <strong>{formatScore(classData?.classImpactScore)}</strong>
          {classData?.rankings?.nationalRank != null ? (
            <span>#{classData.rankings.nationalRank} natl</span>
          ) : null}
        </div>
        <div className="gv-landing-fc-widget__impact">
          <p>Team Impact</p>
          <strong>{formatScore(classData?.teamImpactScore)}</strong>
          <span>avg commit fit</span>
        </div>
        <div className="gv-landing-fc-widget__impact">
          <p>Commits</p>
          <strong>{classData?.commitCount ?? home?.commitTotal ?? '—'}</strong>
          <span>{classData?.blueChips ?? 0} blue-chips</span>
        </div>
        <div className="gv-landing-fc-widget__impact">
          <p>SEC Rank</p>
          <strong>
            {classData?.rankings?.secRank != null ? `#${classData.rankings.secRank}` : '—'}
          </strong>
          <span>{classData?.inStatePct ?? 0}% in-state</span>
        </div>
      </div>

      <div className="gv-landing-fc-preview__heat gv-landing-fc-widget__heat">
        <div>
          <p>Up</p>
          <strong>{up}</strong>
        </div>
        <div>
          <p>Down</p>
          <strong>{down}</strong>
        </div>
        <div>
          <p>Flat</p>
          <strong>{flat}</strong>
        </div>
      </div>

      <div className="gv-landing-fc-preview__panels gv-landing-fc-widget__panels">
        <div>
          <h4>Top Target</h4>
          {topTarget ? (
            <>
              <p className="gv-landing-fc-widget__panel-name">{topTarget.fullName}</p>
              <ConfidenceBar value={topTarget.confidence} />
              <div className="gv-landing-fc-widget__panel-row">
                <TrendingIndicator delta={topTarget.delta ?? 0} />
                <span>{Math.round(topTarget.confidence)}% UF</span>
              </div>
            </>
          ) : (
            <p>—</p>
          )}
        </div>
        <div>
          <h4>Latest Commit</h4>
          {latestCommit ? (
            <>
              <p className="gv-landing-fc-widget__panel-name">{latestCommit.fullName}</p>
              <span className="gv-landing-fc-widget__panel-sub">
                {latestCommit.position} · Fit {formatScore(latestCommit.ufFitScore ?? null)}
              </span>
            </>
          ) : (
            <p>—</p>
          )}
        </div>
        <div>
          <h4>Portal Watch</h4>
          {portalPick ? (
            <>
              <p className="gv-landing-fc-widget__panel-name">{portalPick.fullName}</p>
              <span className="gv-landing-fc-widget__panel-sub">
                {portalPick.portalLikelihood}% likelihood
              </span>
            </>
          ) : (
            <p>—</p>
          )}
        </div>
      </div>

      {featuredPick ? (
        <div className="gv-landing-fc-widget__featured">
          <h4>Trend History · {featuredPick.fullName}</h4>
          <PickRow pick={featuredPick} />
        </div>
      ) : null}

      {predictions?.predictions && predictions.predictions.length > 1 ? (
        <div className="gv-landing-fc-widget__predictions">
          <h4>Active Predictions</h4>
          <div className="gv-landing-fc-widget__pick-list">
            {predictions.predictions.slice(0, 4).map((p) => (
              <PickRow key={p.playerId} pick={p} />
            ))}
          </div>
        </div>
      ) : null}

      {predictions?.predictors?.length ? (
        <div className="gv-landing-fc-widget__predictors">
          <h4>Predictors</h4>
          <ul>
            {predictions.predictors.slice(0, 3).map((p) => (
              <li key={p.predictorId}>
                <span>{p.name}</span>
                <span>
                  {p.picks} picks · {p.hits + p.misses > 0 ? `${Math.round(p.hitRate * 100)}% hit` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <a href="/futurecast" className="gv-landing-fc-preview__foot gv-landing-fc-widget__foot">
        Open FutureCast Master Board →
      </a>
    </div>
  );
}

export function HomepageFutureCastWidget(): React.ReactElement {
  const [retryKey, setRetryKey] = useState(0);

  return (
    <FutureCastWidgetErrorBoundary onRetry={() => setRetryKey((k) => k + 1)}>
      <HomepageFutureCastWidgetInner key={retryKey} />
    </FutureCastWidgetErrorBoundary>
  );
}
