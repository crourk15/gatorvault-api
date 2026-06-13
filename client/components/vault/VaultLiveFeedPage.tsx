'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchLiveDashboard, type BeatPost, type LiveFeedItem, type PodcastShow } from '@/lib/live-api';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

type LiveTab = 'feed' | 'beat' | 'podcast';
type FeedCategory = 'all' | 'news' | 'recruiting' | 'portal' | 'game' | 'podcast';

const REFRESH_MS = 60_000;

const CATEGORY_CHIPS: { id: FeedCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '⚡' },
  { id: 'news', label: 'Headlines', icon: '📰' },
  { id: 'recruiting', label: 'Recruiting', icon: '🎯' },
  { id: 'portal', label: 'Portal', icon: '🔄' },
  { id: 'game', label: 'Game Week', icon: '🏈' },
  { id: 'podcast', label: 'Audio', icon: '🎙️' },
];

const TYPE_ICONS: Record<string, string> = {
  news: '📰',
  headline: '📰',
  recruiting: '🎯',
  portal: '🔄',
  transfer: '🔄',
  game: '🏈',
  score: '📊',
  podcast: '🎙️',
  beat: '✍️',
  x: '𝕏',
};

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'Just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function feedIcon(item: LiveFeedItem): string {
  const t = String(item.type ?? item.source ?? 'news').toLowerCase();
  for (const [key, icon] of Object.entries(TYPE_ICONS)) {
    if (t.includes(key)) return icon;
  }
  return '📌';
}

function matchesCategory(item: LiveFeedItem, cat: FeedCategory): boolean {
  if (cat === 'all') return true;
  const blob = `${item.type ?? ''} ${item.source ?? ''} ${item.title ?? ''}`.toLowerCase();
  if (cat === 'news') return blob.includes('news') || blob.includes('headline') || !blob.includes('recruit');
  if (cat === 'recruiting') return blob.includes('recruit') || blob.includes('commit') || blob.includes('target');
  if (cat === 'portal') return blob.includes('portal') || blob.includes('transfer');
  if (cat === 'game') return blob.includes('game') || blob.includes('score') || blob.includes('gator');
  if (cat === 'podcast') return blob.includes('podcast') || blob.includes('audio');
  return true;
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
  const [tab, setTab] = useState<LiveTab>('feed');
  const [category, setCategory] = useState<FeedCategory>('all');
  const [feed, setFeed] = useState<LiveFeedItem[]>([]);
  const [beat, setBeat] = useState<BeatPost[]>([]);
  const [podcasts, setPodcasts] = useState<PodcastShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    }
    try {
      const dash = await fetchLiveDashboard(40);
      setFeed(dash.feed);
      setBeat(dash.beat.posts ?? []);
      setPodcasts(dash.podcasts.shows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load live feed.');
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

  const filteredFeed = useMemo(
    () => feed.filter((item) => matchesCategory(item, category)),
    [feed, category]
  );

  return (
    <div className="gv-live-feed gv-live-feed--espn" data-testid="vault-live-feed">
      <LiveTicker items={feed} />

      <div className="gv-live-feed__hero">
        <div>
          <h1 className="gv-page-title">GatorNation Live</h1>
          <p className="gv-page-subtitle">Headlines, beat writers, and podcasts — auto-refreshes every minute.</p>
        </div>
        <span className="gv-live-feed__refresh-badge">↻ 60s</span>
      </div>

      <div className="gv-live-feed__tabs">
        <button
          type="button"
          className={`gv-live-feed__tab${tab === 'feed' ? ' is-active' : ''}`}
          onClick={() => setTab('feed')}
        >
          📰 Headlines
        </button>
        <button
          type="button"
          className={`gv-live-feed__tab${tab === 'beat' ? ' is-active' : ''}`}
          onClick={() => setTab('beat')}
        >
          ✍️ Beat Writers
        </button>
        <button
          type="button"
          className={`gv-live-feed__tab${tab === 'podcast' ? ' is-active' : ''}`}
          onClick={() => setTab('podcast')}
        >
          🎙️ Podcasts
        </button>
      </div>

      {tab === 'feed' && (
        <div className="gv-live-feed__chips">
          {CATEGORY_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`gv-live-feed__chip${category === chip.id ? ' is-active' : ''}`}
              onClick={() => setCategory(chip.id)}
            >
              <span aria-hidden="true">{chip.icon}</span> {chip.label}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="gv-page-status">Loading live feed…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load(true)} backHref="/vault" backLabel="← Dashboard" />
      )}

      {!loading && !error && tab === 'feed' && (
        <ul className="gv-live-feed__list">
          {filteredFeed.map((item, i) => (
            <li key={item.id ?? i} className="gv-live-feed__row">
              <span className="gv-live-feed__row-icon" aria-hidden="true">
                {feedIcon(item)}
              </span>
              <div className="gv-live-feed__row-body">
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="gv-live-feed__row-title">
                    {item.title}
                  </a>
                ) : (
                  <p className="gv-live-feed__row-title">{item.title}</p>
                )}
                <p className="gv-live-feed__row-meta">
                  <span className="gv-live-feed__row-source">{item.source || item.type || 'Update'}</span>
                  <span className="gv-live-feed__row-time">{timeAgo(item.createdAt)}</span>
                </p>
              </div>
            </li>
          ))}
          {filteredFeed.length === 0 && <UiEmpty message="No headlines in this category." />}
        </ul>
      )}

      {!loading && !error && tab === 'beat' && (
        <ul className="gv-live-feed__list">
          {beat.map((p, i) => (
            <li key={i} className="gv-live-feed__row gv-live-feed__row--beat">
              <span className="gv-live-feed__row-icon" aria-hidden="true">
                ✍️
              </span>
              <div className="gv-live-feed__row-body">
                <p className="gv-live-feed__beat-handle">@{p.handle}</p>
                <p className="gv-live-feed__beat-text">{p.text}</p>
                <p className="gv-live-feed__row-meta">
                  <span className="gv-live-feed__row-source">
                    {p.outlet ? `${p.writerName} · ${p.outlet}` : p.writerName || 'Beat'}
                  </span>
                  <span className="gv-live-feed__row-time">{timeAgo(p.publishedAt)}</span>
                </p>
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="gv-live-feed__beat-link">
                    View on X →
                  </a>
                ) : null}
              </div>
            </li>
          ))}
          {beat.length === 0 && <UiEmpty message="Beat stream loading or awaiting X token." />}
        </ul>
      )}

      {!loading && !error && tab === 'podcast' && (
        <ul className="gv-live-feed__list gv-live-feed__list--podcasts">
          {podcasts.map((show, i) => (
            <li key={i} className="gv-live-feed__podcast-card">
              <span className="gv-live-feed__podcast-icon" aria-hidden="true">
                🎙️
              </span>
              <div>
                <p className="gv-live-feed__podcast-title">{show.title}</p>
                {show.description ? <p className="gv-live-feed__podcast-desc">{show.description}</p> : null}
                <div className="gv-live-feed__podcast-links">
                  {show.platforms?.map((pl) => (
                    <a
                      key={pl.url}
                      href={pl.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="gv-live-feed__podcast-link"
                    >
                      {pl.name} →
                    </a>
                  ))}
                </div>
              </div>
            </li>
          ))}
          {podcasts.length === 0 && <UiEmpty message="No podcast shows listed yet." />}
        </ul>
      )}
    </div>
  );
}
