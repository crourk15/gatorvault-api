'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, PageLayout, PageSection, TabBar } from '@/components/brand';
import {
  FILM_HUB_ORDER,
  fetchFilmRoomCatalog,
  fetchFilmRoomLesson,
  type FilmRoomCatalogItem,
  type FilmRoomLessonDetail,
} from '@/lib/film-room-api';
import {
  filmRoomHubFromSegment,
  parseFilmRoomSegmentFromPath,
} from '@/lib/vault-route-map';
import { isFilmRoomInsider } from '@/lib/futurecast-insider';
import { UiEmpty, UiError, UiWarming } from '@/components/site/UiMessage';

const HUB_TABS = FILM_HUB_ORDER.map((name) => ({
  id: name,
  label: name.replace('UF ', '').replace(' Scheme', ''),
}));

const HUB_ICONS: Record<string, string> = {
  'Offensive Scheme': '⚔️',
  'Defensive Scheme': '🛡️',
  'Film Breakdown': '🎬',
  'UF Press Conferences': '🎤',
  Highlights: '⭐',
};

function youtubeEmbedUrl(item: FilmRoomCatalogItem): string | null {
  if (item.embedUrl) return item.embedUrl;
  const id = item.youtubeId;
  if (id) return `https://www.youtube.com/embed/${id}`;
  const url = item.sourceUrl || '';
  const match = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function FilmLessonViewer({
  item,
  detail,
  loading,
  onClose,
}: {
  item: FilmRoomCatalogItem;
  detail: FilmRoomLessonDetail | null;
  loading: boolean;
  onClose: () => void;
}): React.ReactElement {
  const embed = youtubeEmbedUrl(item);
  const body = detail?.body || item.body;
  const summary = detail?.summary || item.dek;
  const isSchemeIntel = item.knowledgeEngine || item.noVideo;
  const bodyParas = body
    ? body.split(/\n\n+/).filter((para) => para.trim() && para.trim() !== summary?.trim())
    : [];
  const sources = item.sources?.length
    ? item.sources
    : item.sourceUrl
      ? [{ source_name: item.source, source_url: item.sourceUrl }]
      : [];

  return (
    <PageSection title={item.title} subtitle={item.source || 'Verified coaching source'}>
      <button type="button" className="gv-film-lesson__back" onClick={onClose}>
        ← Back to catalog
      </button>
      <p className="gv-film-lesson__type">
        {embed ? 'Watch — verified film source' : isSchemeIntel ? 'Scheme intel — verified coaching analysis (no video embed)' : 'Verified source'}
      </p>
      {loading ? <p className="gv-page-status">Loading lesson…</p> : null}
      {summary ? <p className="gv-film-lesson__dek">{summary}</p> : null}
      {embed ? (
        <div className="gv-film-lesson__embed">
          <iframe
            title={item.title}
            src={embed}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null}
      {bodyParas.length ? (
        <div className="gv-film-lesson__body">
          {bodyParas.map((para) => (
            <p key={para.slice(0, 40)}>{para}</p>
          ))}
        </div>
      ) : null}
      {!embed && !bodyParas.length && !loading ? (
        <UiEmpty message="Lesson content is being verified." hint="Check back after the next knowledge sync." />
      ) : null}
      {sources.length ? (
        <div className="gv-film-lesson__sources">
          <p className="gv-film-lesson__sources-label">Verified sources</p>
          <ul className="gv-film-lesson__sources-list">
            {sources.map((src) => {
              const url = src.source_url || src.sourceUrl;
              const label = src.source_name || src.sourceName || 'Source';
              if (!url) return null;
              return (
                <li key={`${label}-${url}`}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="gv-film-lesson__link">
                    {label} →
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </PageSection>
  );
}

export function VaultFilmRoomPage(): React.ReactElement {
  const [items, setItems] = useState<FilmRoomCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FilmRoomCatalogItem | null>(null);
  const [lessonDetail, setLessonDetail] = useState<FilmRoomLessonDetail | null>(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [insider, setInsider] = useState(() => isFilmRoomInsider());
  const [hub, setHub] = useState<string>(() => {
    const seg = parseFilmRoomSegmentFromPath();
    return seg ? filmRoomHubFromSegment(seg) : FILM_HUB_ORDER[0];
  });

  useEffect(() => {
    const seg = parseFilmRoomSegmentFromPath();
    if (seg) setHub(filmRoomHubFromSegment(seg));
  }, []);

  useEffect(() => {
    const syncInsider = () => setInsider(isFilmRoomInsider());
    syncInsider();
    window.addEventListener('gv-auth-changed', syncInsider);
    return () => window.removeEventListener('gv-auth-changed', syncInsider);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const catalog = await fetchFilmRoomCatalog();
      setItems(catalog.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Film Room catalog.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, insider]);

  const clearLessonFromUrl = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has('lesson')) return;
    url.searchParams.delete('lesson');
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', next);
  }, []);

  const closeLesson = useCallback(() => {
    setSelected(null);
    setLessonDetail(null);
    clearLessonFromUrl();
  }, [clearLessonFromUrl]);

  const selectHub = useCallback(
    (nextHub: string) => {
      setHub(nextHub);
      if (selected) closeLesson();
    },
    [selected, closeLesson]
  );

  const openLesson = useCallback(
    async (item: FilmRoomCatalogItem) => {
      if (!insider) {
        window.location.href = '/join?tier=film';
        return;
      }
      setSelected(item);
      setLessonDetail(null);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('lesson', item.id);
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
      if (item.body || item.youtubeId || item.embedUrl) return;
      if (!item.knowledgeEngine) return;
      setLessonLoading(true);
      try {
        const detail = await fetchFilmRoomLesson(item.id);
        setLessonDetail(detail);
      } catch {
        setLessonDetail(null);
      } finally {
        setLessonLoading(false);
      }
    },
    [insider]
  );

  useEffect(() => {
    if (loading || !items.length) return;
    const lessonId = new URLSearchParams(window.location.search).get('lesson');
    if (!lessonId) return;
    const match = items.find((i) => i.id === lessonId);
    if (match) void openLesson(match);
  }, [loading, items, openLesson]);

  const hubCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of FILM_HUB_ORDER) counts[h] = 0;
    for (const item of items) {
      const key = item.filmHub || 'Offensive Scheme';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => (i.filmHub || 'Offensive Scheme') === hub);
  }, [items, hub]);

  return (
    <div className="rh-page rh-page--elite gv-film-room-page mobile-app" data-testid="vault-film-room-elite">
      <PageLayout
        theme="chalkboard"
        title="Film Room"
        subtitle="Scheme breakdowns, press conferences, and verified coaching analysis."
        testId="vault-film-room"
        className="gv-film-room rh-elite-chrome"
      >
        {loading ? (
          <div className="gv-page-status" role="status" aria-live="polite" aria-busy="true">
            <UiWarming hint="Loading film catalog…" />
          </div>
        ) : null}
        {error ? <UiError message={error} retry={load} backHref="/vault" backLabel="← Vault" /> : null}
      <TabBar
        options={HUB_TABS}
        active={hub}
        onChange={selectHub}
        aria-label="Film room categories"
      />

      {!selected ? (
        <PageSection title="Categories" subtitle="Select a film hub">
          <div className="gv-film-hub-grid" role="list" aria-label="Film room categories">
            {FILM_HUB_ORDER.map((name) => (
              <button
                key={name}
                type="button"
                role="listitem"
                className={`gv-film-hub-card${hub === name ? ' is-active' : ''}`}
                onClick={() => selectHub(name)}
                aria-pressed={hub === name}
              >
                <span className="gv-film-hub-card__icon" aria-hidden="true">
                  {HUB_ICONS[name] ?? '📺'}
                </span>
                <h3 className="gv-film-hub-card__title">{name}</h3>
                <p className="gv-film-hub-card__count">{hubCounts[name] ?? 0} lessons</p>
              </button>
            ))}
          </div>
        </PageSection>
      ) : null}

      {!loading && !error && selected ? (
        <FilmLessonViewer
          item={selected}
          detail={lessonDetail}
          loading={lessonLoading}
          onClose={closeLesson}
        />
      ) : null}

      {!loading && !error && !selected ? (
        <>
          <PageSection
            title={hub}
            subtitle={`${hubCounts[hub] ?? 0} lessons · ${HUB_ICONS[hub] ?? '📺'}`}
          >
            <div className="gv-film-lessons">
              {filtered.map((item) => (
                <Card key={item.id} className="gv-film-lesson gv-film-lesson--clickable">
                  <button type="button" className="gv-film-lesson__open" onClick={() => void openLesson(item)}>
                    <h3 className="gv-film-lesson__title">{item.title}</h3>
                    {item.dek ? <p className="gv-film-lesson__dek">{item.dek}</p> : null}
                    <p className="gv-film-lesson__meta">
                      {item.source || 'Verified source'}
                      {!insider ? ' · 🔒 Film tier' : item.noVideo ? ' · Tap to read' : ' · Tap to watch'}
                    </p>
                  </button>
                </Card>
              ))}
              {filtered.length === 0 && <UiEmpty message="No lessons in this category yet." />}
            </div>
          </PageSection>

          {items.length === 0 && (
            <UiEmpty
              message="Film Room catalog is empty."
              hint="Knowledge lessons sync from the verified coaching database on the API."
            />
          )}
        </>
      ) : null}

      {!insider ? (
        <a href="/join?tier=film" className="gv-paywall-sticky-cta">
          Unlock Film Room + FutureCast · from $9.99/mo
        </a>
      ) : null}
    </PageLayout>
    </div>
  );
}
