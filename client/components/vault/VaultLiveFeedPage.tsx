'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { fetchLiveDashboard, type BeatPost, type LiveFeedItem, type PodcastShow } from '@/lib/live-api';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

type LiveTab = 'feed' | 'beat' | 'podcast';

const REFRESH_MS = 60_000;

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'Just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function VaultLiveFeedPage(): React.ReactElement {
  const [tab, setTab] = useState<LiveTab>('feed');
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

  return (
    <div className="gv-live-feed" data-testid="vault-live-feed">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">GatorNation Live</h1>
        <p className="gv-page-subtitle">Headlines, beat writers, and podcast hub — refreshes every minute.</p>
      </div>

      <div className="gv-alert-choices">
        <button type="button" className={`gv-alert-choice${tab === 'feed' ? ' is-active' : ''}`} onClick={() => setTab('feed')}>Headlines</button>
        <button type="button" className={`gv-alert-choice${tab === 'beat' ? ' is-active' : ''}`} onClick={() => setTab('beat')}>Beat Writers</button>
        <button type="button" className={`gv-alert-choice${tab === 'podcast' ? ' is-active' : ''}`} onClick={() => setTab('podcast')}>Podcasts</button>
      </div>

      {loading && <p className="gv-page-status">Loading live feed…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load(true)} backHref="/vault/game-week" backLabel="← Game Week" />
      )}

      {!loading && !error && tab === 'feed' && (
        <ul className="gv-live-list">
          {feed.map((item, i) => (
            <li key={item.id ?? i} className="gv-live-item">
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="gv-live-item__title">
                  {item.title}
                </a>
              ) : (
                <p className="gv-live-item__title">{item.title}</p>
              )}
              <p className="gv-live-item__meta">
                {item.type || item.source || 'Update'} · {timeAgo(item.createdAt)}
              </p>
            </li>
          ))}
          {feed.length === 0 && <UiEmpty message="No headlines yet." />}
        </ul>
      )}

      {!loading && !error && tab === 'beat' && (
        <ul className="gv-live-list">
          {beat.map((p, i) => (
            <li key={i} className="gv-live-item gv-live-item--beat">
              <p className="gv-live-item__handle">@{p.handle}</p>
              <p className="gv-live-item__text">{p.text}</p>
              <p className="gv-live-item__meta">
                {p.outlet ? `${p.writerName} · ${p.outlet} · ` : ''}
                {timeAgo(p.publishedAt)}
              </p>
              {p.url ? (
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="gv-live-item__link">
                  View on X →
                </a>
              ) : null}
            </li>
          ))}
          {beat.length === 0 && <UiEmpty message="Beat stream loading or awaiting X token." />}
        </ul>
      )}

      {!loading && !error && tab === 'podcast' && (
        <ul className="gv-live-list">
          {podcasts.map((show, i) => (
            <li key={i} className="gv-live-item">
              <p className="gv-live-item__title">{show.title}</p>
              {show.description ? <p className="gv-live-item__text">{show.description}</p> : null}
              {show.platforms?.map((pl) => (
                <a
                  key={pl.url}
                  href={pl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gv-live-item__link"
                >
                  {pl.name} →
                </a>
              ))}
            </li>
          ))}
          {podcasts.length === 0 && <UiEmpty message="No podcast shows listed yet." />}
        </ul>
      )}
    </div>
  );
}
