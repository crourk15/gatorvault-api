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
import { buildSeedFilmRoomCatalog } from '@/lib/film-room-hub-seed';
import {
  filmRoomHubFromSegment,
  parseFilmRoomSegmentFromPath,
} from '@/lib/vault-route-map';
import { useUser, useInsiderUnlock } from '@/lib/useUser';
import { usePathname } from '@/lib/use-pathname';
import {
  SCHEME_SCHOOL_LESSONS,
  SCHEME_SCHOOL_UNITS,
  schemeSchoolLesson,
  type SchemeSchoolLesson,
} from '@/lib/scheme-school-data';
import { UiEmpty, UiError, UiWarming } from '@/components/site/UiMessage';

const HUB_TABS = FILM_HUB_ORDER.map((name) => ({
  id: name,
  label:
    name === 'UF Press Conferences'
      ? 'Press Conferences'
      : name === 'Scheme School'
        ? 'Scheme School'
        : name,
}));

const HUB_COPY: Record<string, { desc: string }> = {
  'Film Breakdown': {
    desc: 'Premium video hub — Film Guy Network, GNFP, and verified tape breakdowns.',
  },
  'Scheme School': {
    desc: 'Fan-friendly football education from UF\'s real staff — no clinic jargon.',
  },
  'UF Press Conferences': {
    desc: 'Sumrall, Faulkner, White, and position coaches — supporting content.',
  },
  Highlights: {
    desc: 'Official Gators highlights — supporting content.',
  },
};

function formatFilmDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function filmLessonSubtitle(item: FilmRoomCatalogItem): string | null {
  const line = item.dek || item.gameLine || item.category || null;
  return line && String(line).trim() ? String(line).trim() : null;
}

function filmLessonMeta(item: FilmRoomCatalogItem, insider: boolean): string {
  const parts: string[] = [];
  const date = formatFilmDate(item.publishedAt || item.lastVerified);
  if (item.source) parts.push(item.source);
  if (date) parts.push(date);
  if (!insider) parts.push('🔒 Film tier');
  else if (item.noVideo || item.knowledgeEngine) parts.push('Read lesson');
  else parts.push('Tap to watch');
  return parts.join(' · ');
}

/** Netlify-hosted relay — Capacitor WebViews hit Error 153 on direct youtube.com/embed. */
const YOUTUBE_EMBED_SITE = 'https://gatorvaultinsider.com';

function extractYoutubeId(item: FilmRoomCatalogItem): string | null {
  const direct = (item.youtubeId || '').trim();
  if (/^[\w-]{11}$/.test(direct)) return direct;
  const urls = [item.embedUrl, item.videoUrl, item.sourceUrl].filter(Boolean) as string[];
  for (const u of urls) {
    const match = u.match(
      /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|shorts\/|watch\?.*?v=)|[?&]v=)([\w-]{11})/
    );
    if (match) return match[1];
  }
  return null;
}

function youtubeEmbedUrl(item: FilmRoomCatalogItem): string | null {
  // API already returns the relay for native App Store shells that only honor embedUrl.
  if (item.embedUrl && item.embedUrl.includes('/youtube-embed.html')) return item.embedUrl;
  const id = extractYoutubeId(item);
  if (!id) return null;
  return `${YOUTUBE_EMBED_SITE}/youtube-embed.html?v=${encodeURIComponent(id)}`;
}

function youtubeWatchUrl(item: FilmRoomCatalogItem): string | null {
  const id = extractYoutubeId(item);
  return id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : null;
}

function SchemeSchoolViewer({
  lesson,
  onClose,
}: {
  lesson: SchemeSchoolLesson;
  onClose: () => void;
}): React.ReactElement {
  return (
    <PageSection title={lesson.title} subtitle={lesson.staff}>
      <button type="button" className="gv-film-lesson__back" onClick={onClose}>
        ← Back to Scheme School
      </button>
      <p className="gv-fr-scheme-viewer__staff">{lesson.staff}</p>
      <p className="gv-film-lesson__dek">{lesson.dek}</p>
      {lesson.usageNote ? <p className="gv-film-lesson__type">{lesson.usageNote}</p> : null}
      <div className="gv-film-lesson__body">
        <p>{lesson.body}</p>
      </div>
      <div className="gv-fr-scheme-viewer__watch">
        <h4>What to watch for</h4>
        <ul>
          {lesson.watchFor.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </div>
    </PageSection>
  );
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
  const watchUrl = youtubeWatchUrl(item);
  const body = detail?.body || item.body;
  const summary = detail?.summary || item.dek;
  const isSchemeIntel = item.knowledgeEngine || item.noVideo;
  const bodyParas = body
    ? body.split(/\n\n+/).filter((para) => para.trim() && para.trim() !== summary?.trim())
    : [];

  return (
    <PageSection title={item.title} subtitle={item.source || 'Florida Gators Football'}>
      <button type="button" className="gv-film-lesson__back" onClick={onClose}>
        ← Back to catalog
      </button>
      <p className="gv-film-lesson__type">
        {embed ? 'Watch — verified film source' : isSchemeIntel ? 'Scheme intel — read' : 'Verified source'}
      </p>
      {loading ? <p className="gv-page-status">Loading lesson…</p> : null}
      {summary ? <p className="gv-film-lesson__dek">{summary}</p> : null}
      {embed ? (
        <div className="gv-film-lesson__embed">
          <iframe
            title={item.title}
            src={embed}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : null}
      {watchUrl ? (
        <p className="gv-film-lesson__watch-ext">
          <a href={watchUrl} target="_blank" rel="noopener noreferrer">
            Open in YouTube
          </a>
        </p>
      ) : null}
      {bodyParas.length ? (
        <div className="gv-film-lesson__body">
          {bodyParas.map((para) => (
            <p key={para.slice(0, 40)}>{para}</p>
          ))}
        </div>
      ) : null}
      {!embed && !bodyParas.length && !loading ? (
        <UiEmpty message="Lesson content is being verified." hint="Check back after the next sync." />
      ) : null}
    </PageSection>
  );
}

function CatalogGrid({
  items,
  insider,
  onOpen,
}: {
  items: FilmRoomCatalogItem[];
  insider: boolean;
  onOpen: (item: FilmRoomCatalogItem) => void;
}): React.ReactElement {
  if (!items.length) {
    return <UiEmpty message="No content in this section yet." hint="Weekly refresh adds new tape and pressers." />;
  }
  return (
    <div className="gv-fr-lessons">
      {items.map((item) => (
        <Card key={item.id} className="gv-fr-lesson-card">
          <button type="button" className="gv-fr-lesson-card__btn" onClick={() => void onOpen(item)}>
            <h3 className="gv-fr-lesson-card__title">{item.title}</h3>
            {filmLessonSubtitle(item) ? (
              <p className="gv-fr-lesson-card__dek">{filmLessonSubtitle(item)}</p>
            ) : null}
            <p className="gv-fr-lesson-card__meta">{filmLessonMeta(item, insider)}</p>
            <span className="gv-fr-lesson-card__cta">
              {item.youtubeId || item.embedUrl ? 'Tap to watch →' : insider ? 'Read lesson →' : 'Unlock →'}
            </span>
          </button>
        </Card>
      ))}
    </div>
  );
}

function SchemeSchoolGrid({
  insider,
  onOpen,
  onUnlock,
}: {
  insider: boolean;
  onOpen: (lesson: SchemeSchoolLesson) => void;
  onUnlock: () => void;
}): React.ReactElement {
  return (
    <>
      {SCHEME_SCHOOL_UNITS.map((unit) => {
        const lessons = SCHEME_SCHOOL_LESSONS.filter((l) => l.unit === unit.id);
        return (
          <div key={unit.id} className="gv-fr-scheme-unit">
            <h3 className="gv-fr-scheme-unit__title">{unit.label}</h3>
            <div className="gv-fr-lessons">
              {lessons.map((lesson) => (
                <Card key={lesson.id} className="gv-fr-lesson-card">
                  <button
                    type="button"
                    className="gv-fr-lesson-card__btn"
                    onClick={() => {
                      if (!insider) {
                        onUnlock();
                        return;
                      }
                      onOpen(lesson);
                    }}
                  >
                    <h3 className="gv-fr-lesson-card__title">{lesson.title}</h3>
                    <p className="gv-fr-lesson-card__dek">{lesson.dek}</p>
                    <p className="gv-fr-lesson-card__meta">{lesson.staff}</p>
                    <span className="gv-fr-lesson-card__cta">{insider ? 'Read lesson →' : 'Unlock →'}</span>
                  </button>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function hubFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const hub = new URLSearchParams(window.location.search).get('hub');
  if (hub === 'Game Week') return 'Film Breakdown';
  if (hub && FILM_HUB_ORDER.includes(hub)) return hub;
  return null;
}

const SEED_CATALOG = buildSeedFilmRoomCatalog();
const HAS_FILM_SEED = SEED_CATALOG.items.length > 0;

export function VaultFilmRoomPage(): React.ReactElement {
  const pathname = usePathname();
  const { isInsider: insider } = useUser();
  const { navigate: goToUnlock } = useInsiderUnlock({ returnPath: pathname });
  const [items, setItems] = useState<FilmRoomCatalogItem[]>(HAS_FILM_SEED ? SEED_CATALOG.items : []);
  // Seeded catalog paints immediately; Scheme School never needs the API.
  const [loading, setLoading] = useState(!HAS_FILM_SEED);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FilmRoomCatalogItem | null>(null);
  const [schemeLesson, setSchemeLesson] = useState<SchemeSchoolLesson | null>(null);
  const [lessonDetail, setLessonDetail] = useState<FilmRoomLessonDetail | null>(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [hub, setHub] = useState<string>(() => {
    const fromUrl = hubFromUrl();
    if (fromUrl) return fromUrl;
    const seg = parseFilmRoomSegmentFromPath();
    return seg ? filmRoomHubFromSegment(seg) : FILM_HUB_ORDER[0];
  });

  useEffect(() => {
    const fromUrl = hubFromUrl();
    if (fromUrl) setHub(fromUrl);
    else {
      const seg = parseFilmRoomSegmentFromPath();
      if (seg) setHub(filmRoomHubFromSegment(seg));
    }
  }, []);

  const load = useCallback(async () => {
    if (!HAS_FILM_SEED) {
      setLoading(true);
      setError(null);
    }
    try {
      const catalog = await fetchFilmRoomCatalog();
      setItems(catalog.items);
      setError(null);
    } catch (err) {
      if (!HAS_FILM_SEED) {
        setError(err instanceof Error ? err.message : 'Could not load Film Room catalog.');
        setItems([]);
      }
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
    url.searchParams.delete('lesson');
    url.searchParams.delete('scheme');
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', next);
  }, []);

  const closeLesson = useCallback(() => {
    setSelected(null);
    setSchemeLesson(null);
    setLessonDetail(null);
    clearLessonFromUrl();
  }, [clearLessonFromUrl]);

  const selectHub = useCallback(
    (nextHub: string) => {
      setHub(nextHub);
      if (selected || schemeLesson) closeLesson();
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('hub', nextHub);
        url.searchParams.delete('lesson');
        url.searchParams.delete('scheme');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        // Reset document scroll so hub switches don't leave a trapped mid-page offset.
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    },
    [selected, schemeLesson, closeLesson]
  );

  const openLesson = useCallback(
    async (item: FilmRoomCatalogItem) => {
      if (!insider) {
        goToUnlock();
        return;
      }
      setSchemeLesson(null);
      setSelected(item);
      setLessonDetail(null);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('lesson', item.id);
        url.searchParams.delete('scheme');
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

  const openSchemeLesson = useCallback((lesson: SchemeSchoolLesson) => {
    setSelected(null);
    setLessonDetail(null);
    setSchemeLesson(lesson);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('scheme', lesson.id);
      url.searchParams.delete('lesson');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    const schemeId = new URLSearchParams(window.location.search).get('scheme');
    if (schemeId) {
      const match = schemeSchoolLesson(schemeId);
      if (match) setSchemeLesson(match);
      return;
    }
    if (!items.length) return;
    const lessonId = new URLSearchParams(window.location.search).get('lesson');
    if (!lessonId) return;
    const match = items.find((i) => i.id === lessonId);
    if (match) void openLesson(match);
  }, [loading, items, openLesson]);

  const filtered = useMemo(() => {
    return items.filter((i) => (i.filmHub || 'Film Breakdown') === hub);
  }, [items, hub]);

  const hubCopy = HUB_COPY[hub];

  return (
    <div className="rh-page rh-page--elite gv-film-room-page mobile-app" data-testid="vault-film-room-elite">
      <PageLayout
        theme="navy"
        title=""
        subtitle=""
        testId="vault-film-room"
        className="rh-elite-chrome"
        hero={
          <section className="rh-hero-strip" aria-label="Film Room">
            <div className="rh-hero-sweep" aria-hidden="true" />
            <div className="rh-hero-watermark" aria-hidden="true">
              GATORS
            </div>
            <div className="rh-hero-top">
              <div>
                <h1 className="rh-hero-title">Film Room</h1>
                <p className="rh-hero-subtitle">Real football. Real breakdowns. Real coaching intel.</p>
              </div>
              <span className="rh-badge rh-hero-badge">FILM</span>
            </div>
          </section>
        }
      >
        {loading && hub !== 'Scheme School' ? (
          <div className="gv-page-status" role="status" aria-live="polite" aria-busy="true">
            <UiWarming hint="Loading film catalog…" />
          </div>
        ) : null}
        {error ? <UiError message={error} retry={load} backHref="/vault" backLabel="← Vault" /> : null}

        <TabBar options={HUB_TABS} active={hub} onChange={selectHub} aria-label="Film room sections" />

        {!loading && !error && schemeLesson ? (
          <SchemeSchoolViewer lesson={schemeLesson} onClose={closeLesson} />
        ) : null}

        {!loading && !error && selected && !schemeLesson ? (
          <FilmLessonViewer
            item={selected}
            detail={lessonDetail}
            loading={lessonLoading}
            onClose={closeLesson}
          />
        ) : null}

        {!loading && !error && !selected && !schemeLesson ? (
          <>
            <p className="gv-fr-hub-desc">{hubCopy?.desc ?? ''}</p>

            {hub === 'Scheme School' ? (
              <PageSection title="Scheme School" subtitle="UF staff · fan-friendly lessons">
                <SchemeSchoolGrid insider={insider} onOpen={openSchemeLesson} onUnlock={goToUnlock} />
              </PageSection>
            ) : (
              <PageSection title={HUB_TABS.find((t) => t.id === hub)?.label ?? hub}>
                <CatalogGrid items={filtered} insider={insider} onOpen={openLesson} />
              </PageSection>
            )}
          </>
        ) : null}

        {!insider ? (
          <a
            href="#"
            className="gv-paywall-sticky-cta"
            onClick={(e) => {
              e.preventDefault();
              goToUnlock();
            }}
          >
            Unlock Film Room + FutureCast · from $9.99/mo
          </a>
        ) : null}
      </PageLayout>
    </div>
  );
}
