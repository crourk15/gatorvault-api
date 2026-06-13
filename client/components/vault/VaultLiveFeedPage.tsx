'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchLiveDashboard, type BeatPost, type LiveFeedItem, type PodcastShow } from '@/lib/live-api';
import { UiEmpty, UiError } from '@/components/site/UiMessage';
import {
  liveFeedTabPath,
  parseLiveFeedTabFromPath,
  type LiveFeedTab,
} from '@/lib/vault-route-map';
import { saveVaultPageState, useVaultDataReload, useVaultPageRestore } from '@/lib/vault-navigation';

const REFRESH_MS = 60_000;
const LIVE_STATE_KEY = 'live';

type FeedCategory =
  | 'all'
  | 'commit'
  | 'portal'
  | 'visit'
  | 'offer'
  | 'prediction'
  | 'article'
  | 'score'
  | 'thread';

const CATEGORY_KEYS: FeedCategory[] = [
  'all',
  'commit',
  'portal',
  'visit',
  'offer',
  'prediction',
  'article',
  'score',
  'thread',
];

const CATEGORY_LABELS: Record<FeedCategory, string> = {
  all: 'All',
  commit: 'Commits',
  portal: 'Portal',
  visit: 'Visits',
  offer: 'Offers',
  prediction: 'Predictions',
  article: 'Articles',
  score: 'Scores',
  thread: 'Threads',
};

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'Just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function normalizeFeedType(item: LiveFeedItem): FeedCategory | null {
  const raw = String(item.type ?? '').toLowerCase();
  if (raw === 'offers') return 'offer';
  if (CATEGORY_KEYS.includes(raw as FeedCategory)) return raw as FeedCategory;
  const blob = `${item.title ?? ''} ${item.source ?? ''}`.toLowerCase();
  if (blob.includes('commit')) return 'commit';
  if (blob.includes('portal') || blob.includes('transfer')) return 'portal';
  if (blob.includes('visit')) return 'visit';
  if (blob.includes('offer')) return 'offer';
  if (blob.includes('predict')) return 'prediction';
  if (blob.includes('score')) return 'score';
  if (raw === 'news' || raw === 'headline' || blob.includes('article')) return 'article';
  if (raw === 'thread' || raw === 'beat') return 'thread';
  return 'article';
}

function typeLabel(type: FeedCategory): string {
  const map: Record<FeedCategory, string> = {
    all: 'All',
    commit: 'Commit',
    portal: 'Portal',
    visit: 'Visit',
    offer: 'Offer',
    prediction: 'Prediction',
    article: 'Article',
    score: 'Score',
    thread: 'Thread',
  };
  return map[type] ?? 'Info';
}

function liveTabToInternal(tab: LiveFeedTab): 'feed' | 'beat' | 'podcast' {
  if (tab === 'beat') return 'beat';
  if (tab === 'podcasts') return 'podcast';
  return 'feed';
}

function LiveTicker({ items }: { items: LiveFeedItem[] }): React.ReactElement | null {
  const headlines = items.slice(0, 12);
  if (headlines.length === 0) return null;
  const tickerText = headlines
    .map((h) => h.title?.trim())
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="gv-live-ticker" aria-label="Breaking headlines ticker">
      <span className="gv-live-ticker__badge">LIVE</span>
      <div className="gv-live-ticker__track">
        <span className="gv-live-ticker__text">{tickerText}</span>
        <span className="gv-live-ticker__text" aria-hidden="true">
          {tickerText}
        </span>
      </div>
    </div>
  );
}

export function VaultLiveFeedPage(): React.ReactElement {
  const [tab, setTab] = useState<'feed' | 'beat' | 'podcast'>(() =>
    liveTabToInternal(parseLiveFeedTabFromPath() ?? 'headlines')
  );
  const [category, setCategory] = useState<FeedCategory>('all');
  const [feed, setFeed] = useState<LiveFeedItem[]>([]);
  const [beat, setBeat] = useState<BeatPost[]>([]);
  const [podcasts, setPodcasts] = useState<PodcastShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useVaultPageRestore(LIVE_STATE_KEY, (saved) => {
    if (saved.tab === 'beat' || saved.tab === 'podcast' || saved.tab === 'feed') {
      setTab(saved.tab);
    }
    if (saved.filters?.category && CATEGORY_KEYS.includes(saved.filters.category as FeedCategory)) {
      setCategory(saved.filters.category as FeedCategory);
    }
  });

  const persistState = useCallback(() => {
    saveVaultPageState(LIVE_STATE_KEY, {
      tab,
      scrollY: window.scrollY,
      filters: { category },
    });
  }, [tab, category]);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    }
    try {
      const dash = await fetchLiveDashboard(60);
      setFeed(dash.feed);
      setBeat(dash.beat.posts ?? []);
      setPodcasts(dash.podcasts.shows ?? []);
      setUpdatedAt(dash.updatedAt ?? new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load live feed.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useVaultDataReload(() => void load(false));

  useEffect(() => {
    const sync = () => setTab(liveTabToInternal(parseLiveFeedTabFromPath() ?? 'headlines'));
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const selectTab = (next: LiveFeedTab) => {
    const internal = liveTabToInternal(next);
    setTab(internal);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', liveFeedTabPath(next));
      saveVaultPageState(LIVE_STATE_KEY, { tab: internal, scrollY: window.scrollY, filters: { category } });
    }
  };

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

  useEffect(() => {
    const onLeave = () => persistState();
    window.addEventListener('pagehide', onLeave);
    return () => window.removeEventListener('pagehide', onLeave);
  }, [persistState]);

  const normalizedFeed = useMemo(
    () =>
      feed
        .map((item) => ({ item, type: normalizeFeedType(item) }))
        .filter((row): row is { item: LiveFeedItem; type: FeedCategory } => row.type != null),
    [feed]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<FeedCategory, number> = {
      all: normalizedFeed.length,
      commit: 0,
      portal: 0,
      visit: 0,
      offer: 0,
      prediction: 0,
      article: 0,
      score: 0,
      thread: 0,
    };
    for (const { type } of normalizedFeed) counts[type] += 1;
    return counts;
  }, [normalizedFeed]);

  const filteredFeed = useMemo(() => {
    if (category === 'all') return normalizedFeed;
    return normalizedFeed.filter((row) => row.type === category);
  }, [normalizedFeed, category]);

  const groupedFeed = useMemo(() => {
    const groups = new Map<string, typeof filteredFeed>();
    for (const row of filteredFeed) {
      const key = row.type;
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    return groups;
  }, [filteredFeed]);

  return (
    <div className="gv-live-feed gv-live-feed--classic" data-testid="vault-live-feed">
      <LiveTicker items={feed} />

      <div className="gv-live-feed__hero">
        <div>
          <h1 className="gv-page-title">
            ⚡ GatorNation Live <span className="gv-live-dot" aria-hidden="true" />
          </h1>
          <p className="gv-page-subtitle">
            Real-time commits, portal, visits, beat writers, and podcasts — auto-refreshes every 60s.
          </p>
        </div>
        <span className="gv-live-feed__refresh-badge">↻ 60s{updatedAt ? ` · ${timeAgo(updatedAt)}` : ''}</span>
      </div>

      <div className="gv-live-feed__tabs">
        <button
          type="button"
          className={`gv-live-feed__tab${tab === 'feed' ? ' is-active' : ''}`}
          onClick={() => selectTab('headlines')}
        >
          📰 Live Feed
        </button>
        <button
          type="button"
          className={`gv-live-feed__tab${tab === 'beat' ? ' is-active' : ''}`}
          onClick={() => selectTab('beat')}
        >
          𝕏 Beat Writers
        </button>
        <button
          type="button"
          className={`gv-live-feed__tab${tab === 'podcast' ? ' is-active' : ''}`}
          onClick={() => selectTab('podcasts')}
        >
          🎙️ Podcasts
        </button>
      </div>

      {loading && <p className="gv-page-status">Loading live feed…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load(true)} backHref="/vault" backLabel="← Dashboard" />
      )}

      {!loading && !error && tab === 'feed' && (
        <>
          <div className="gv-live-categories">
            {CATEGORY_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`gv-live-categories__pill${category === key ? ' is-active' : ''}`}
                onClick={() => {
                  setCategory(key);
                  saveVaultPageState(LIVE_STATE_KEY, { tab, scrollY: window.scrollY, filters: { category: key } });
                }}
              >
                {CATEGORY_LABELS[key]} <span>{categoryCounts[key]}</span>
              </button>
            ))}
          </div>

          <div className="live-feed-list">
            {filteredFeed.length === 0 && <UiEmpty message="No live items in this category yet." />}
            {category === 'all'
              ? filteredFeed.map(({ item, type }, i) => (
                  <article key={item.id ?? i} className="live-feed-item live-feed-item--linked">
                    <div className="live-feed-item__head">
                      <span className={`live-type-pill live-type-${type}`}>{typeLabel(type)}</span>
                      <span className="live-feed-item__time">{timeAgo(item.createdAt)}</span>
                    </div>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="live-feed-link">
                        {item.title}
                      </a>
                    ) : (
                      <p className="live-feed-item__title">{item.title}</p>
                    )}
                    {item.source ? <p className="live-feed-item__source">{item.source}</p> : null}
                  </article>
                ))
              : Array.from(groupedFeed.entries()).map(([type, rows]) => (
                  <section key={type} className="gv-live-group">
                    <h2 className="gv-live-group__title">{CATEGORY_LABELS[type as FeedCategory]}</h2>
                    {rows.map(({ item }, i) => (
                      <article key={item.id ?? i} className="live-feed-item live-feed-item--linked">
                        <div className="live-feed-item__head">
                          <span className={`live-type-pill live-type-${type}`}>{typeLabel(type as FeedCategory)}</span>
                          <span className="live-feed-item__time">{timeAgo(item.createdAt)}</span>
                        </div>
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="live-feed-link">
                            {item.title}
                          </a>
                        ) : (
                          <p className="live-feed-item__title">{item.title}</p>
                        )}
                        {item.source ? <p className="live-feed-item__source">{item.source}</p> : null}
                      </article>
                    ))}
                  </section>
                ))}
          </div>
        </>
      )}

      {!loading && !error && tab === 'beat' && (
        <div className="live-feed-list">
          {beat.map((p, i) => (
            <article
              key={i}
              className="gv-beat-card"
              role={p.url ? 'link' : undefined}
              tabIndex={p.url ? 0 : undefined}
              onClick={() => p.url && window.open(p.url, '_blank', 'noopener,noreferrer')}
              onKeyDown={(e) => {
                if (p.url && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  window.open(p.url, '_blank', 'noopener,noreferrer');
                }
              }}
            >
              <div className="gv-beat-card__head">
                <span className="gv-beat-card__handle">@{String(p.handle ?? '').replace(/^@/, '')}</span>
                <span className="gv-beat-card__time">{timeAgo(p.publishedAt)}</span>
              </div>
              <p className="gv-beat-text">{p.text}</p>
              {p.outlet ? (
                <p className="gv-beat-card__meta">
                  {p.writerName} · {p.outlet}
                </p>
              ) : null}
            </article>
          ))}
          {beat.length === 0 && <UiEmpty message="Beat stream loading or awaiting posts." />}
        </div>
      )}

      {!loading && !error && tab === 'podcast' && (
        <div className="live-feed-list">
          {podcasts.map((show, i) => (
            <article key={i} className="live-pod-card">
              <span className="live-pod-card__icon" aria-hidden="true">
                🎙️
              </span>
              <div>
                <p className="live-pod-card__title">{show.title}</p>
                {show.description ? <p className="live-pod-card__desc">{show.description}</p> : null}
                <div className="live-pod-platforms">
                  {show.platforms?.map((pl) => (
                    <a
                      key={pl.url}
                      href={pl.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="live-pod-platform-pill"
                    >
                      {pl.name}
                    </a>
                  ))}
                </div>
              </div>
            </article>
          ))}
          {podcasts.length === 0 && <UiEmpty message="No podcast shows listed yet." />}
        </div>
      )}
    </div>
  );
}
