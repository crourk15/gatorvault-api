'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchLiveDashboard,
  type LiveFeedItem,
  type PodcastShow,
} from '@/lib/live-api';
import { MediaCard } from '@/components/media/MediaCard';
import {
  resolvePodcastHosts,
  resolvePodcastLogo,
  resolvePodcastLogoFallback,
} from '@/lib/podcast-catalog';
import { LIVE_REFRESH_MS, matchesCategory, timeAgo } from './live-feed-utils';

function MicIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M19 11a7 7 0 0 1-14 0M12 18v3M8 21h8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FlameIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 22c4-2.5 7-6.5 7-11a7 7 0 0 0-13-3.5C5.5 9.5 4 12 4 14.5 4 18.5 7.5 21.5 12 22Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VaultMediaCard({
  children,
  testId,
}: {
  children: React.ReactNode;
  testId?: string;
}): React.ReactElement {
  return (
    <div className="gv-vault-media-card" data-testid={testId}>
      {children}
    </div>
  );
}

export function PodcastCard({ show }: { show: PodcastShow }): React.ReactElement {
  const catalogKey = show.id ?? show.title;
  const hosts = show.hosts?.length
    ? show.hosts.join(', ')
    : resolvePodcastHosts(catalogKey).join(', ');
  const imageUrl = show.logoUrl ?? show.thumbnailUrl ?? resolvePodcastLogo(catalogKey);
  return (
    <MediaCard
      title={show.title ?? 'Podcast'}
      subtitle={hosts || show.description}
      imageUrl={imageUrl}
      imageFallback={resolvePodcastLogoFallback(catalogKey)}
      className="media-card--podcast"
      testId="podcast-card"
    >
      <div className="media-card-links">
        {(show.platforms ?? []).map((pl) => (
          <a
            key={pl.url}
            href={pl.url}
            target="_blank"
            rel="noopener noreferrer"
            className="media-card-link"
            onClick={(e) => e.stopPropagation()}
          >
            {pl.name}
          </a>
        ))}
      </div>
    </MediaCard>
  );
}

export function RecruitingUpdateCard({ item }: { item: LiveFeedItem }): React.ReactElement {
  const source = item.source || item.type || 'GatorVault';
  const title = item.title ?? 'Recruiting update';
  const meta = `Source: ${source}${item.createdAt ? ` • ${timeAgo(item.createdAt)} ago` : ''}`;

  return (
    <VaultMediaCard testId="recruiting-update-card">
      <div className="gv-vault-media-card__update">
        <div className="gv-vault-media-card__headline-row">
          <FlameIcon className="gv-vault-media-card__icon gv-vault-media-card__icon--orange" />
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="gv-vault-media-card__headline gv-vault-media-card__headline--link"
            >
              {title}
            </a>
          ) : (
            <p className="gv-vault-media-card__headline">{title}</p>
          )}
        </div>
        <p className="gv-vault-media-card__meta">{meta}</p>
      </div>
    </VaultMediaCard>
  );
}

function SectionHeader({
  icon,
  iconClass,
  title,
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
}): React.ReactElement {
  return (
    <h2 className="gv-vault-media-section__title">
      <span className={iconClass}>{icon}</span>
      {title}
    </h2>
  );
}

function CardGrid({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="podcast-grid gv-vault-media-section__grid">{children}</div>;
}

function SkeletonCard(): React.ReactElement {
  return <div className="gv-vault-media-card gv-vault-media-card--skeleton" aria-hidden="true" />;
}

export function PodcastsRecruitingSection({
  limit = 6,
  className,
}: {
  limit?: number;
  className?: string;
}): React.ReactElement {
  const [podcasts, setPodcasts] = useState<PodcastShow[]>([]);
  const [feed, setFeed] = useState<LiveFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    }
    try {
      const dash = await fetchLiveDashboard(Math.max(limit, 40));
      setPodcasts(dash.podcasts.shows ?? []);
      setFeed(dash.feed ?? []);
    } catch (err) {
      if (isInitial) {
        setError(err instanceof Error ? err.message : 'Could not load media hub.');
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function run(isInitial: boolean) {
      if (cancelled) return;
      await load(isInitial);
    }

    void run(true);
    timer = setInterval(() => void run(false), LIVE_REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [load]);

  const recruitingUpdates = useMemo(
    () => feed.filter((item) => matchesCategory(item, 'recruiting')).slice(0, limit),
    [feed, limit]
  );

  const podcastCards = podcasts.slice(0, limit);

  return (
    <section
      className={`gv-vault-media-section${className ? ` ${className}` : ''}`}
      data-testid="podcasts-recruiting-section"
      aria-label="Gator Podcasts and Latest Recruiting Updates"
    >
      <div className="gv-vault-media-section__block">
        <SectionHeader
          icon={<MicIcon className="gv-vault-media-section__svg" />}
          iconClass="gv-vault-media-section__icon gv-vault-media-section__icon--blue"
          title="Gator Podcasts"
        />
        {loading && !podcastCards.length ? (
          <CardGrid>
            <SkeletonCard />
            <SkeletonCard />
          </CardGrid>
        ) : podcastCards.length ? (
          <CardGrid>
            {podcastCards.map((show, i) => (
              <PodcastCard key={`${show.title}-${i}`} show={show} />
            ))}
          </CardGrid>
        ) : (
          <p className="gv-vault-media-section__empty">No podcast shows listed yet.</p>
        )}
      </div>

      <div className="gv-vault-media-section__block">
        <SectionHeader
          icon={<FlameIcon className="gv-vault-media-section__svg" />}
          iconClass="gv-vault-media-section__icon gv-vault-media-section__icon--orange"
          title="Latest Recruiting Updates"
        />
        {loading && !recruitingUpdates.length ? (
          <CardGrid>
            <SkeletonCard />
            <SkeletonCard />
          </CardGrid>
        ) : recruitingUpdates.length ? (
          <CardGrid>
            {recruitingUpdates.map((item, i) => (
              <RecruitingUpdateCard key={item.id ?? `ru-${i}`} item={item} />
            ))}
          </CardGrid>
        ) : (
          <p className="gv-vault-media-section__empty">
            {error ? error : 'No recruiting updates in the feed yet.'}
          </p>
        )}
      </div>
    </section>
  );
}
