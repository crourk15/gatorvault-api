'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfidenceBar } from '@/components/futurecast/ConfidenceBar';
import { TrendingIndicator } from '@/components/futurecast/TrendingIndicator';
import {
  FUTURECAST_WIDGET_YEAR,
  loadFutureCastWidgetBundle,
  readFutureCastWidgetCache,
  type FutureCastWidgetBundle,
  type FutureCastWidgetLoadMeta,
} from '@/lib/futurecast-home-api';
import {
  buildFutureCastWidgetView,
  type FutureCastWidgetView,
  type WidgetProspectCard,
} from '@/lib/futurecast-widget-model';

const REFRESH_MS = 60_000;
const PREDICTIONS_LIMIT = 6;
const FOOTER_HREF = '/vault/futurecast';

function formatScore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value >= 10 ? value.toFixed(1) : `${Math.round(value)}`;
}

function formatUpdatedAt(iso: string | null, fallback: Date | null): string {
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
  }
  if (fallback) {
    return fallback.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return '—';
}

function TrendSparkline({ values }: { values: number[] }): React.ReactElement | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 88;
  const h = 26;
  const coords = values
    .map((v, i) => {
      const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
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

function PredictorList({ predictors }: { predictors: WidgetProspectCard['topPredictors'] }): React.ReactElement | null {
  if (!predictors.length) return null;
  return (
    <ul className="gv-landing-fc-widget__predictor-tags">
      {predictors.map((p) => (
        <li key={p.name}>
          <span>{p.name}</span>
          {p.score > 0 ? <span>{p.score}%</span> : null}
        </li>
      ))}
    </ul>
  );
}

function ProspectCard({
  card,
  featured = false,
}: {
  card: WidgetProspectCard;
  featured?: boolean;
}): React.ReactElement {
  return (
    <article
      className={`gv-landing-fc-widget__card${featured ? ' gv-landing-fc-widget__card--featured' : ''}`}
      data-testid={featured ? 'fc-top-prospect' : 'fc-trending-card'}
    >
      <div className="gv-landing-fc-widget__card-head">
        <div>
          <h4 className="gv-landing-fc-widget__card-name">{card.playerName}</h4>
          <p className="gv-landing-fc-widget__card-meta">
            {card.position} · {card.team}
          </p>
        </div>
        <TrendingIndicator delta={card.movementDelta} />
      </div>
      <div className="gv-landing-fc-widget__card-confidence">
        <span>{Math.round(card.confidence)}% UF</span>
        <ConfidenceBar value={card.confidence} />
      </div>
      <PredictorList predictors={card.topPredictors} />
      {card.trendHistory.length > 1 ? <TrendSparkline values={card.trendHistory} /> : null}
    </article>
  );
}

function WidgetHeader({
  updatedLabel,
  fromCache,
}: {
  updatedLabel: string;
  fromCache: boolean;
}): React.ReactElement {
  return (
    <header className="gv-landing-fc-widget__head">
      <div>
        <h3>FutureCast — {FUTURECAST_WIDGET_YEAR} Cycle</h3>
        <p className="gv-landing-fc-widget__sub">
          Movement, confidence, predictors, and class impact
        </p>
      </div>
      <span className="gv-landing-fc-widget__refresh" title="Live FutureCast API">
        {fromCache ? 'Cached · ' : 'Updated '}
        {updatedLabel}
      </span>
    </header>
  );
}

function WidgetSkeleton(): React.ReactElement {
  return (
    <div className="gv-landing-fc-widget gv-landing-fc-widget--loading" data-testid="fc-widget-skeleton">
      <WidgetHeader updatedLabel="—" fromCache={false} />

      <section className="gv-landing-fc-widget__section">
        <h4 className="gv-landing-fc-widget__section-title">Top Prospect</h4>
        <div className="gv-landing-fc-widget__card gv-landing-fc-widget__card--featured">
          <div className="gv-landing-fc-widget__skeleton gv-landing-fc-widget__skeleton--line-lg" />
          <div className="gv-landing-fc-widget__skeleton gv-landing-fc-widget__skeleton--line-sm" />
          <div className="gv-landing-fc-widget__skeleton-movement" aria-hidden>
            <span>•</span>
            <span>•</span>
            <span>•</span>
          </div>
          <div className="gv-landing-fc-widget__skeleton gv-landing-fc-widget__skeleton--bar" />
          <div className="gv-landing-fc-widget__skeleton gv-landing-fc-widget__skeleton--spark" />
        </div>
      </section>

      <section className="gv-landing-fc-widget__section">
        <h4 className="gv-landing-fc-widget__section-title">Class Impact</h4>
        <div className="gv-landing-fc-widget__impact-row">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="gv-landing-fc-widget__skeleton gv-landing-fc-widget__skeleton--stat" />
          ))}
        </div>
      </section>

      <section className="gv-landing-fc-widget__section">
        <h4 className="gv-landing-fc-widget__section-title">Trending Predictions</h4>
        <div className="gv-landing-fc-widget__trending-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="gv-landing-fc-widget__card">
              <div className="gv-landing-fc-widget__skeleton gv-landing-fc-widget__skeleton--line-md" />
              <div className="gv-landing-fc-widget__skeleton gv-landing-fc-widget__skeleton--line-sm" />
              <div className="gv-landing-fc-widget__skeleton-movement" aria-hidden>
                <span>•</span>
              </div>
              <div className="gv-landing-fc-widget__skeleton gv-landing-fc-widget__skeleton--bar" />
            </div>
          ))}
        </div>
      </section>

      <div className="gv-landing-fc-widget__skeleton gv-landing-fc-widget__skeleton--foot" />
    </div>
  );
}

function ClassImpactSummary({
  summary,
}: {
  summary: FutureCastWidgetView['classSummary'];
}): React.ReactElement | null {
  const items: React.ReactNode[] = [];

  if (summary.classImpactScore != null) {
    items.push(
      <div key="class" className="gv-landing-fc-widget__impact">
        <p>Class Impact</p>
        <strong>{formatScore(summary.classImpactScore)}</strong>
      </div>
    );
  }
  if (summary.teamImpactScore != null) {
    items.push(
      <div key="team" className="gv-landing-fc-widget__impact">
        <p>Team Impact</p>
        <strong>{formatScore(summary.teamImpactScore)}</strong>
      </div>
    );
  }
  if (summary.nationalRank != null) {
    items.push(
      <div key="natl" className="gv-landing-fc-widget__impact">
        <p>National</p>
        <strong>#{summary.nationalRank}</strong>
      </div>
    );
  }
  if (summary.secRank != null) {
    items.push(
      <div key="sec" className="gv-landing-fc-widget__impact">
        <p>SEC</p>
        <strong>#{summary.secRank}</strong>
      </div>
    );
  }
  if (summary.blueChipRatio != null) {
    items.push(
      <div key="blue" className="gv-landing-fc-widget__impact">
        <p>Blue Chip</p>
        <strong>{summary.blueChipRatio}%</strong>
      </div>
    );
  }
  if (summary.inStatePercentage > 0) {
    items.push(
      <div key="instate" className="gv-landing-fc-widget__impact">
        <p>In-State</p>
        <strong>{summary.inStatePercentage}%</strong>
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <section className="gv-landing-fc-widget__section" data-testid="fc-class-impact">
      <h4 className="gv-landing-fc-widget__section-title">Class Impact</h4>
      <div className="gv-landing-fc-widget__impact-row">{items}</div>
    </section>
  );
}

function WidgetContent({
  view,
  lastRefresh,
  fromCache,
}: {
  view: FutureCastWidgetView;
  lastRefresh: Date | null;
  fromCache: boolean;
}): React.ReactElement {
  const updatedLabel = formatUpdatedAt(view.updatedAt, lastRefresh);

  return (
    <div className="gv-landing-fc-widget" data-testid="homepage-fc-widget">
      <WidgetHeader updatedLabel={updatedLabel} fromCache={fromCache} />

      <section className="gv-landing-fc-widget__section">
        <h4 className="gv-landing-fc-widget__section-title">Top Prospect</h4>
        {view.topProspect ? (
          <ProspectCard card={view.topProspect} featured />
        ) : (
          <p className="gv-landing-fc-widget__empty">No top prospect in the {FUTURECAST_WIDGET_YEAR} board yet.</p>
        )}
      </section>

      <ClassImpactSummary summary={view.classSummary} />

      <section className="gv-landing-fc-widget__section">
        <h4 className="gv-landing-fc-widget__section-title">Trending Predictions</h4>
        {view.trending.length > 0 ? (
          <div className="gv-landing-fc-widget__trending-grid">
            {view.trending.map((card) => (
              <ProspectCard key={card.playerId} card={card} />
            ))}
          </div>
        ) : (
          <p className="gv-landing-fc-widget__empty">No trending predictions available.</p>
        )}
      </section>

      <a href={FOOTER_HREF} className="gv-landing-fc-preview__foot gv-landing-fc-widget__foot">
        View Full FutureCast Board →
      </a>
    </div>
  );
}

function WidgetError({
  meta,
  onRetry,
}: {
  meta: FutureCastWidgetLoadMeta | null;
  onRetry: () => void;
}): React.ReactElement {
  const offline = meta?.offline;
  const title = offline ? 'FutureCast temporarily offline' : 'FutureCast unavailable — retry';

  return (
    <div className="gv-landing-fc-widget gv-landing-fc-widget--error" role="alert">
      <WidgetHeader updatedLabel="—" fromCache={false} />
      <p>{title}</p>
      {!offline ? (
        <p className="gv-landing-fc-widget__error-detail">
          Live API did not respond within 2.5 seconds.
        </p>
      ) : (
        <p className="gv-landing-fc-widget__error-detail">
          The FutureCast service returned a temporary error. Try again shortly.
        </p>
      )}
      <button type="button" className="gv-landing-fc-widget__retry" onClick={onRetry}>
        Retry
      </button>
      <a href={FOOTER_HREF} className="gv-landing-fc-widget__cta-link">
        View Full FutureCast Board →
      </a>
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
        <WidgetError
          meta={null}
          onRetry={() => {
            this.setState({ error: null });
            this.props.onRetry?.();
          }}
        />
      );
    }
    return this.props.children;
  }
}

function HomepageFutureCastWidgetInner(): React.ReactElement {
  const [bundle, setBundle] = useState<FutureCastWidgetBundle | null>(null);
  const [meta, setMeta] = useState<FutureCastWidgetLoadMeta | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const [failed, setFailed] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const bundleRef = useRef<FutureCastWidgetBundle | null>(null);

  const view = useMemo(
    () => (bundle ? buildFutureCastWidgetView(bundle) : null),
    [bundle]
  );

  const load = useCallback(async (isBackground: boolean) => {
    if (!isBackground && !bundleRef.current) {
      setHydrating(true);
    }

    const result = await loadFutureCastWidgetBundle({ predictionsLimit: PREDICTIONS_LIMIT });

    if (result.bundle) {
      bundleRef.current = result.bundle;
      setBundle(result.bundle);
      setMeta(result.meta);
      setLastRefresh(new Date());
      setFromCache(result.meta.fromCache);
      setFailed(false);
    } else if (!bundleRef.current) {
      setMeta(result.meta);
      setFailed(true);
    }

    setHydrating(false);
  }, []);

  useEffect(() => {
    const cached = readFutureCastWidgetCache();
    if (cached) {
      bundleRef.current = cached;
      setBundle(cached);
      setFromCache(true);
      setLastRefresh(new Date());
      setHydrating(false);
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function run(isBackground: boolean) {
      if (cancelled) return;
      await load(isBackground);
    }

    void run(!!cached);
    timer = setInterval(() => void run(true), REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [load]);

  if (hydrating && !bundle) {
    return <WidgetSkeleton />;
  }

  if (failed && !bundle) {
    return <WidgetError meta={meta} onRetry={() => void load(false)} />;
  }

  if (!view) {
    return <WidgetSkeleton />;
  }

  return <WidgetContent view={view} lastRefresh={lastRefresh} fromCache={fromCache} />;
}

export function HomepageFutureCastWidget(): React.ReactElement {
  const [retryKey, setRetryKey] = useState(0);

  return (
    <FutureCastWidgetErrorBoundary onRetry={() => setRetryKey((k) => k + 1)}>
      <Suspense fallback={<WidgetSkeleton />}>
        <HomepageFutureCastWidgetInner key={retryKey} />
      </Suspense>
    </FutureCastWidgetErrorBoundary>
  );
}
