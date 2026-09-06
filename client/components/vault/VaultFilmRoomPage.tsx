'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageLayout, PageSection } from '@/components/brand';
import {
  FILM_HUB_ORDER,
  fetchFilmRoomCatalog,
  fetchFilmRoomLesson,
  normalizeFilmHub,
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
  schemeSchoolLesson,
  type SchemeSchoolLesson,
} from '@/lib/scheme-school-data';
import {
  VAULT_REVIEW_HUB,
  latestVaultFilmReview,
  liveVaultFilmReviews,
  vaultFilmReview,
  type VaultFilmReview,
} from '@/lib/vault-film-review-data';
import { EliteSchemeSchoolGrid, EliteSchemeSchoolViewer } from '@/components/vault/film-room/EliteSchemeSchool';
import { VaultFilmReviewGrid, VaultFilmReviewViewer } from '@/components/vault/film-room/VaultFilmReviewPanel';
import { UiEmpty, UiError, UiWarming } from '@/components/site/UiMessage';
import '@/lib/film-room-elite.css';

const HUB_TABS = FILM_HUB_ORDER.map((name) => ({
  id: name,
  label:
    name === 'UF Press Conferences'
      ? 'Press'
      : name === 'Scheme School'
        ? 'Scheme'
        : name === 'Film Breakdown'
          ? 'Breakdowns'
          : name === VAULT_REVIEW_HUB
            ? 'Review'
            : name,
  fullLabel:
    name === 'UF Press Conferences'
      ? 'Press Conferences'
      : name === 'Film Breakdown'
        ? 'Film Breakdowns'
        : name === VAULT_REVIEW_HUB
          ? 'GatorVault Film Review'
          : name,
}));

const HUB_COPY: Record<string, { desc: string; kicker: string }> = {
  [VAULT_REVIEW_HUB]: {
    kicker: 'Our board',
    desc: 'Offense, defense, and specials — only after we watch the Florida tape. Week 1 vs FAU is waiting on that watch.',
  },
  'Film Breakdown': {
    kicker: 'Also on tape',
    desc: 'GNFP, Film Guy Network, and trusted film sources. Their Gators tape — not ours.',
  },
  'Scheme School': {
    kicker: 'Install board',
    desc: 'How Faulkner, White, and Whitt actually run it — call sheet, Saturday tell, what wins.',
  },
  'UF Press Conferences': {
    kicker: 'On the record',
    desc: 'Sumrall, Faulkner, White, and position coaches — straight from the podium.',
  },
  Highlights: {
    kicker: 'Official cuts',
    desc: 'Official Gators highlight packages and supporting game tape.',
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
  if (!insider) parts.push('Film tier');
  else if (item.noVideo || item.knowledgeEngine) parts.push('Read lesson');
  else parts.push('Watch');
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

function youtubeThumbUrl(item: FilmRoomCatalogItem): string | null {
  const id = extractYoutubeId(item);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

function youtubeEmbedUrl(item: FilmRoomCatalogItem): string | null {
  if (item.embedUrl && item.embedUrl.includes('/youtube-embed.html')) return item.embedUrl;
  const id = extractYoutubeId(item);
  if (!id) return null;
  return `${YOUTUBE_EMBED_SITE}/youtube-embed.html?v=${encodeURIComponent(id)}`;
}

function youtubeWatchUrl(item: FilmRoomCatalogItem): string | null {
  const id = extractYoutubeId(item);
  return id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : null;
}

function sortCatalogNewest(items: FilmRoomCatalogItem[]): FilmRoomCatalogItem[] {
  return [...items].sort((a, b) => {
    const ta = Date.parse(String(a.publishedAt || a.lastVerified || '')) || 0;
    const tb = Date.parse(String(b.publishedAt || b.lastVerified || '')) || 0;
    return tb - ta;
  });
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
  const [embedActive, setEmbedActive] = useState(false);
  const bodyParas = body
    ? body.split(/\n\n+/).filter((para) => para.trim() && para.trim() !== summary?.trim())
    : [];

  useEffect(() => {
    setEmbedActive(false);
  }, [item.id]);

  return (
    <PageSection title={item.title} subtitle={item.source || 'Florida Gators Football'}>
      <button type="button" className="gv-film-lesson__back" onClick={onClose}>
        ← Back to Film Room
      </button>
      <p className="gv-film-lesson__type">
        {embed ? 'Watch — verified film source' : isSchemeIntel ? 'Scheme intel — read' : 'Verified source'}
      </p>
      {loading ? <p className="gv-page-status">Loading lesson…</p> : null}
      {summary ? <p className="gv-film-lesson__dek">{summary}</p> : null}
      {embed ? (
        <div
          className={`gv-film-lesson__embed${embedActive ? ' is-active' : ''}`}
          onPointerDown={() => {
            if (!embedActive) setEmbedActive(true);
          }}
        >
          {!embedActive ? (
            <button
              type="button"
              className="gv-film-lesson__embed-activate"
              onClick={() => setEmbedActive(true)}
              aria-label={`Play ${item.title}`}
            >
              Tap to play
            </button>
          ) : null}
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

function FilmThumb({
  item,
  className = '',
}: {
  item: FilmRoomCatalogItem;
  className?: string;
}): React.ReactElement {
  const thumb = youtubeThumbUrl(item);
  return (
    <div className={`gv-fr-thumb${className ? ` ${className}` : ''}`} aria-hidden>
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" loading="lazy" decoding="async" />
      ) : (
        <div className="gv-fr-thumb__slate">
          <span>FILM</span>
        </div>
      )}
      <span className="gv-fr-thumb__play" />
    </div>
  );
}

function CatalogCard({
  item,
  insider,
  onOpen,
  featured = false,
}: {
  item: FilmRoomCatalogItem;
  insider: boolean;
  onOpen: (item: FilmRoomCatalogItem) => void;
  featured?: boolean;
}): React.ReactElement {
  const subtitle = filmLessonSubtitle(item);
  return (
    <article
      className={`gv-fr-card${featured ? ' gv-fr-card--featured' : ''}`}
      data-testid={featured ? 'gv-fr-featured' : 'gv-fr-card'}
    >
      <button type="button" className="gv-fr-card__btn" onClick={() => void onOpen(item)}>
        <FilmThumb item={item} />
        <div className="gv-fr-card__body">
          {featured ? <span className="gv-fr-card__eyebrow">Latest drop</span> : null}
          <h3 className="gv-fr-card__title">{item.title}</h3>
          {subtitle ? <p className="gv-fr-card__dek">{subtitle}</p> : null}
          <p className="gv-fr-card__meta">{filmLessonMeta(item, insider)}</p>
          <span className="gv-fr-card__cta">
            {item.youtubeId || item.embedUrl ? 'Watch now' : insider ? 'Read lesson' : 'Unlock'}
          </span>
        </div>
      </button>
    </article>
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
    return (
      <UiEmpty
        message="No content in this section yet."
        hint="New pressers and reviews land as they publish."
      />
    );
  }

  const sorted = sortCatalogNewest(items);
  const [featured, ...rest] = sorted;

  return (
    <div className="gv-fr-catalog">
      {featured ? (
        <CatalogCard item={featured} insider={insider} onOpen={onOpen} featured />
      ) : null}
      {rest.length ? (
        <div className="gv-fr-grid" data-testid="gv-fr-grid">
          {rest.map((item) => (
            <CatalogCard key={item.id} item={item} insider={insider} onOpen={onOpen} />
          ))}
        </div>
      ) : null}
    </div>
  );
}


function FilmHubRail({
  active,
  counts,
  onChange,
}: {
  active: string;
  counts: Record<string, number>;
  onChange: (hub: string) => void;
}): React.ReactElement {
  return (
    <div className="gv-fr-rail" role="tablist" aria-label="Film room sections">
      {HUB_TABS.map((tab) => {
        const count = counts[tab.id] ?? 0;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`gv-fr-rail__tab${isActive ? ' is-active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            <span className="gv-fr-rail__label">{tab.label}</span>
            {tab.id === 'Film Breakdown' || tab.id === 'UF Press Conferences' || tab.id === 'Highlights' || count > 0 ? (
              <span className="gv-fr-rail__count">{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function hubFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const hub = new URLSearchParams(window.location.search).get('hub');
  if (!hub) return null;
  return normalizeFilmHub(hub);
}

const SEED_CATALOG = buildSeedFilmRoomCatalog();
const HAS_FILM_SEED = SEED_CATALOG.items.length > 0;

export function VaultFilmRoomPage(): React.ReactElement {
  const pathname = usePathname();
  const { isInsider: insider } = useUser();
  const { navigate: goToUnlock } = useInsiderUnlock({ returnPath: pathname });
  const [items, setItems] = useState<FilmRoomCatalogItem[]>(HAS_FILM_SEED ? SEED_CATALOG.items : []);
  const [loading, setLoading] = useState(!HAS_FILM_SEED);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FilmRoomCatalogItem | null>(null);
  const [schemeLesson, setSchemeLesson] = useState<SchemeSchoolLesson | null>(null);
  const [review, setReview] = useState<VaultFilmReview | null>(null);
  const [lessonDetail, setLessonDetail] = useState<FilmRoomLessonDetail | null>(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [hub, setHub] = useState<string>(() => {
    const fromUrl = hubFromUrl();
    if (fromUrl) return fromUrl;
    const seg = parseFilmRoomSegmentFromPath();
    if (seg) return filmRoomHubFromSegment(seg);
    // Empty Review is not the landing page — that rail waits on real Florida tape.
    return liveVaultFilmReviews().length > 0 ? VAULT_REVIEW_HUB : 'Film Breakdown';
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
      setItems(
        (catalog.items ?? []).map((item) => ({
          ...item,
          filmHub: normalizeFilmHub(item.filmHub),
        }))
      );
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

  useEffect(() => {
    document.body.classList.add('gv-film-page-active');
    return () => document.body.classList.remove('gv-film-page-active');
  }, []);

  const clearLessonFromUrl = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('lesson');
    url.searchParams.delete('scheme');
    url.searchParams.delete('review');
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', next);
  }, []);

  const closeLesson = useCallback(() => {
    setSelected(null);
    setSchemeLesson(null);
    setReview(null);
    setLessonDetail(null);
    clearLessonFromUrl();
  }, [clearLessonFromUrl]);

  const selectHub = useCallback(
    (nextHub: string) => {
      setHub(nextHub);
      if (selected || schemeLesson || review) closeLesson();
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('hub', nextHub);
        url.searchParams.delete('lesson');
        url.searchParams.delete('scheme');
        url.searchParams.delete('review');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    },
    [selected, schemeLesson, review, closeLesson]
  );

  const openLesson = useCallback(
    async (item: FilmRoomCatalogItem) => {
      if (!insider) {
        goToUnlock();
        return;
      }
      setSchemeLesson(null);
      setReview(null);
      setSelected(item);
      setLessonDetail(null);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('lesson', item.id);
        url.searchParams.delete('scheme');
        url.searchParams.delete('review');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
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
    [insider, goToUnlock]
  );

  const openSchemeLesson = useCallback((lesson: SchemeSchoolLesson) => {
    setSelected(null);
    setReview(null);
    setLessonDetail(null);
    setHub('Scheme School');
    setSchemeLesson(lesson);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('hub', 'Scheme School');
      url.searchParams.set('scheme', lesson.id);
      url.searchParams.delete('lesson');
      url.searchParams.delete('review');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, []);

  const openReview = useCallback((next: VaultFilmReview) => {
    setSelected(null);
    setSchemeLesson(null);
    setLessonDetail(null);
    setHub(VAULT_REVIEW_HUB);
    setReview(next);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('hub', VAULT_REVIEW_HUB);
      url.searchParams.set('review', next.id);
      url.searchParams.delete('lesson');
      url.searchParams.delete('scheme');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(window.location.search);
    const reviewId = params.get('review');
    if (reviewId) {
      const match = vaultFilmReview(reviewId);
      if (match) {
        setHub(VAULT_REVIEW_HUB);
        setReview(match);
        return;
      }
    }
    const schemeId = params.get('scheme');
    if (schemeId) {
      const match = schemeSchoolLesson(schemeId);
      if (match) setSchemeLesson(match);
      return;
    }
    if (!items.length) return;
    const lessonId = params.get('lesson');
    if (!lessonId) return;
    const match = items.find((i) => i.id === lessonId);
    if (match) void openLesson(match);
  }, [loading, items, openLesson]);

  const hubCounts = useMemo(() => {
    const counts: Record<string, number> = {
      [VAULT_REVIEW_HUB]: liveVaultFilmReviews().length,
      'Film Breakdown': 0,
      'Scheme School': SCHEME_SCHOOL_LESSONS.length,
      'UF Press Conferences': 0,
      Highlights: 0,
    };
    for (const item of items) {
      const key = normalizeFilmHub(item.filmHub);
      if (key === VAULT_REVIEW_HUB || key === 'Scheme School') continue;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => normalizeFilmHub(i.filmHub) === hub);
  }, [items, hub]);

  const hubCopy = HUB_COPY[hub];
  const hubTab = HUB_TABS.find((t) => t.id === hub);
  const viewingLesson = Boolean(selected || schemeLesson || review);
  const latestReview = latestVaultFilmReview();
  const schemeSeenVs =
    schemeLesson && latestReview?.schemeLessonIds.includes(schemeLesson.id)
      ? latestReview.opponentShort
      : null;

  return (
    <div className="rh-page rh-page--elite gv-film-room-page mobile-app" data-testid="vault-film-room-elite">
      <PageLayout theme="navy" title="" subtitle="" testId="vault-film-room" className="gv-fr-shell">
        <header className="gv-fr-hero" aria-label="Film Room">
          <div className="gv-fr-hero__atmosphere" aria-hidden="true" />
          <div className="gv-fr-hero__inner">
            <p className="gv-fr-hero__brand">GatorVault</p>
            <h1 className="gv-fr-hero__title">Film Room</h1>
            <p className="gv-fr-hero__sub">Our board. Their tape. The install.</p>
          </div>
        </header>

        {loading && hub !== 'Scheme School' && hub !== VAULT_REVIEW_HUB ? (
          <div className="gv-page-status" role="status" aria-live="polite" aria-busy="true">
            <UiWarming hint="Loading film catalog…" />
          </div>
        ) : null}
        {error ? <UiError message={error} retry={load} backHref="/vault" backLabel="← Vault" /> : null}

        {!viewingLesson ? (
          <FilmHubRail active={hub} counts={hubCounts} onChange={selectHub} />
        ) : null}

        {!loading && !error && review ? (
          <VaultFilmReviewViewer
            review={review}
            onClose={closeLesson}
            onOpenScheme={(id) => {
              const lesson = schemeSchoolLesson(id);
              if (lesson) openSchemeLesson(lesson);
            }}
          />
        ) : null}

        {!loading && !error && schemeLesson && !review ? (
          <EliteSchemeSchoolViewer
            lesson={schemeLesson}
            seenVs={schemeSeenVs}
            onClose={closeLesson}
            onOpenRelated={openSchemeLesson}
            onOpenReview={
              latestReview
                ? () => {
                    openReview(latestReview);
                  }
                : undefined
            }
          />
        ) : null}

        {!loading && !error && selected && !schemeLesson && !review ? (
          <FilmLessonViewer
            item={selected}
            detail={lessonDetail}
            loading={lessonLoading}
            onClose={closeLesson}
          />
        ) : null}

        {!loading && !error && !selected && !schemeLesson && !review ? (
          <section className="gv-fr-stage" aria-label={hubTab?.fullLabel ?? hub}>
            <div className="gv-fr-stage__head">
              <div>
                <p className="gv-fr-stage__kicker">{hubCopy?.kicker ?? 'Film'}</p>
                <h2 className="gv-fr-stage__title">{hubTab?.fullLabel ?? hub}</h2>
                <p className="gv-fr-stage__desc">{hubCopy?.desc ?? ''}</p>
              </div>
              <p className="gv-fr-stage__count">
                {hub === VAULT_REVIEW_HUB
                  ? hubCounts[VAULT_REVIEW_HUB]
                    ? `${hubCounts[VAULT_REVIEW_HUB]} reviews`
                    : 'Waiting on tape'
                  : hub === 'Scheme School'
                    ? `${hubCounts['Scheme School']} installs`
                    : `${filtered.length} videos`}
              </p>
            </div>

            {hub === VAULT_REVIEW_HUB ? (
              <VaultFilmReviewGrid insider={insider} onOpen={openReview} onUnlock={goToUnlock} />
            ) : hub === 'Scheme School' ? (
              <EliteSchemeSchoolGrid insider={insider} onOpen={openSchemeLesson} onUnlock={goToUnlock} />
            ) : (
              <CatalogGrid items={filtered} insider={insider} onOpen={openLesson} />
            )}
          </section>
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
