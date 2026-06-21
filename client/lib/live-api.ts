import { snapshotFirstFetch, snapshotLiveFetch } from './snapshot-fetch';
import {
  catalogPlatformsFromStreams,
  findPodcastCatalogEntry,
  resolvePodcastLogo,
  resolvePodcastHosts,
} from './podcast-catalog';

export interface LiveFeedItem {
  id?: string;
  title?: string;
  type?: string;
  source?: string;
  createdAt?: string;
  url?: string;
}

export interface BeatPost {
  handle?: string;
  text?: string;
  publishedAt?: string;
  outlet?: string;
  writerName?: string;
  url?: string;
}

export interface PodcastShow {
  id?: string;
  title?: string;
  description?: string;
  logoUrl?: string;
  thumbnailUrl?: string;
  image?: string;
  artwork?: string;
  hosts?: string[];
  episodeTitle?: string;
  publishedAt?: string;
  platforms?: { name: string; url: string }[];
}

export interface LiveDashboard {
  feed: LiveFeedItem[];
  beat: { posts?: BeatPost[]; error?: string };
  podcasts: { shows?: PodcastShow[] };
  updatedAt?: string;
  refreshedAt?: string;
  cacheAgeMs?: number | null;
  stale?: boolean;
}

export interface SocialFeedLane {
  id: string;
  label: string;
  icon: string;
  handle?: string;
  posts: BeatPost[];
}

function normalizePodcastShow(raw: Record<string, unknown>): PodcastShow {
  const id = String(raw.id ?? '');
  const title = String(raw.title ?? raw.name ?? 'Podcast');
  const catalog = findPodcastCatalogEntry(id || title);
  const platformsFromRaw = Array.isArray(raw.platforms)
    ? (raw.platforms as Record<string, unknown>[]).map((p) => ({
        name: String(p.name ?? p.label ?? 'Listen'),
        url: String(p.url ?? '#'),
      }))
    : [];
  const platforms =
    platformsFromRaw.length > 0
      ? platformsFromRaw
      : catalogPlatformsFromStreams(id || title);
  const logoUrl = String(
    raw.logoUrl ?? catalog?.logoUrl ?? resolvePodcastLogo(id || title)
  );
  const episodes = Array.isArray(raw.episodes) ? raw.episodes : [];
  const firstEpisode = episodes[0] as Record<string, unknown> | undefined;
  const episodeTitle = firstEpisode ? String(firstEpisode.title ?? '') : undefined;
  const publishedAt = firstEpisode
    ? String(firstEpisode.publishedAt ?? firstEpisode.pubDate ?? '')
    : undefined;
  return {
    id: id || catalog?.id,
    title,
    description: String(raw.description ?? ''),
    logoUrl,
    thumbnailUrl: String(raw.thumbnailUrl ?? raw.image ?? raw.artwork ?? logoUrl),
    hosts: Array.isArray(raw.hosts)
      ? (raw.hosts as unknown[]).map((h) => String(h))
      : catalog?.hosts ?? resolvePodcastHosts(id || title),
    episodeTitle: episodeTitle || undefined,
    publishedAt: publishedAt || undefined,
    platforms,
  };
}

export async function fetchLiveDashboard(
  limit = 40,
  options: { force?: boolean } = {}
): Promise<LiveDashboard> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (options.force) qs.set('refresh', '1');
  const path = `/api/live/dashboard?${qs.toString()}`;

  const data = await snapshotFirstFetch(path, () => snapshotLiveFetch<LiveDashboard & {
    ok?: boolean;
    podcasts?: { shows?: Record<string, unknown>[] };
  }>(path));

  const rawShows = data.podcasts?.shows ?? [];
  return {
    feed: data.feed ?? [],
    beat: data.beat ?? { posts: [] },
    podcasts: {
      shows: rawShows.map((s) => normalizePodcastShow(s as Record<string, unknown>)),
    },
    updatedAt: data.updatedAt,
    refreshedAt: data.refreshedAt,
    cacheAgeMs: data.cacheAgeMs ?? null,
    stale: data.stale,
  };
}

/** Build social lanes from beat posts for ESPN-style layout. */
export function buildSocialLanes(beat: BeatPost[]): SocialFeedLane[] {
  const ufOfficial = beat.filter((p) =>
    /florida|gators|@gators|@uf_football/i.test(`${p.handle} ${p.writerName} ${p.outlet}`)
  );
  const beatWriters = beat.filter(
    (p) => !ufOfficial.includes(p) && (p.outlet || p.writerName)
  );
  const xPosts = beat.filter((p) => p.url?.includes('twitter.com') || p.url?.includes('x.com'));
  return [
    { id: 'x', label: 'X / Twitter', icon: '𝕏', posts: xPosts.slice(0, 8) },
    { id: 'beat', label: 'UF Beat Writers', icon: '✍️', posts: beatWriters.slice(0, 8) },
    { id: 'uf', label: 'UF Official', icon: '🐊', posts: ufOfficial.slice(0, 6) },
  ];
}
