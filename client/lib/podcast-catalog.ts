/**
 * Canonical podcast metadata — logo paths and host names for Podcast Hub surfaces.
 * PNG assets at /public/images/podcasts/*.png are synced from each show's RSS/Apple artwork.
 */

export type PodcastStreamLinks = {
  appleUrl?: string;
  spotifyUrl?: string;
  youtubeUrl?: string;
  siteUrl?: string;
};

export type PodcastCatalogEntry = {
  id: string;
  name: string;
  logoUrl: string;
  logoFallback: string;
  hosts: string[];
} & PodcastStreamLinks;

/** Stream URLs synced from server/data/live/podcasts.json */
export const PODCAST_CATALOG: PodcastCatalogEntry[] = [
  {
    id: 'gators-breakdown',
    name: 'Gators Breakdown',
    logoUrl: '/images/podcasts/gators-breakdown.png',
    logoFallback: '/images/podcasts/gators-breakdown.svg',
    hosts: ['David Waters'],
    appleUrl: 'https://podcasts.apple.com/us/podcast/gators-breakdown/id1169061256',
    spotifyUrl: 'https://open.spotify.com/show/1nLRyUN4rWzgTy0Tu0HjGQ',
    youtubeUrl: 'https://www.youtube.com/gatorsbreakdown',
    siteUrl: 'https://gatorsbreakdown.com',
  },
  {
    id: 'gators-online',
    name: 'Gators Online Podcast',
    logoUrl: '/images/podcasts/gators-online.png',
    logoFallback: '/images/podcasts/gators-online.svg',
    hosts: ['On3 Florida'],
    appleUrl: 'https://podcasts.apple.com/us/podcast/gators-online-podcast/id1618949280',
    spotifyUrl: 'https://open.spotify.com/show/2TJLOsWkqpA7UoLmJuXi6W',
    youtubeUrl: 'https://www.youtube.com/channel/UCVGYXzMCXsvQZtHRLeCG8jA',
    siteUrl: 'https://www.on3.com/teams/florida-gators/page/podcasts/',
  },
  {
    id: 'gnfp',
    name: 'Gator Nation Football Podcast',
    logoUrl: '/images/podcasts/gnfp.png',
    logoFallback: '/images/podcasts/gnfp.svg',
    hosts: ['GNFP'],
    appleUrl: 'https://podcasts.apple.com/us/podcast/the-gator-nation-football-podcast/id1035206093',
    spotifyUrl: 'https://open.spotify.com/show/5g6RBSb7vQCglyfXkm5Pce',
    siteUrl: 'https://gnfp.com',
  },
  {
    id: 'gator-tales',
    name: 'Gator Tales',
    logoUrl: '/images/podcasts/gator-tales.png',
    logoFallback: '/images/podcasts/gator-tales.svg',
    hosts: ['Sean Kelley'],
    appleUrl: 'https://podcasts.apple.com/us/podcast/gator-tales-with-sean-kelley/id1036270178',
    spotifyUrl: 'https://open.spotify.com/show/1Cd7mcwvB2IfsR2WzOWsQq',
    youtubeUrl: 'https://youtube.com/playlist?list=PLSvDmFCp0zGOPSLFuuOLtkmuLVIn_6ynh',
    siteUrl: 'https://floridagators.com/gatortales',
  },
];

export const PODCAST_LOGO_DEFAULT = '/images/podcasts/default.svg';

const BY_ID = new Map(PODCAST_CATALOG.map((p) => [p.id, p]));
const BY_NAME = new Map(PODCAST_CATALOG.map((p) => [p.name.toLowerCase(), p]));

function slugKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function findPodcastCatalogEntry(idOrName?: string): PodcastCatalogEntry | undefined {
  if (!idOrName) return undefined;
  const raw = idOrName.trim();
  const byId = BY_ID.get(raw) ?? BY_ID.get(slugKey(raw));
  if (byId) return byId;
  return BY_NAME.get(raw.toLowerCase());
}

export function resolvePodcastLogo(idOrName?: string): string {
  return findPodcastCatalogEntry(idOrName)?.logoUrl ?? PODCAST_LOGO_DEFAULT;
}

export function resolvePodcastLogoFallback(idOrName?: string): string {
  return findPodcastCatalogEntry(idOrName)?.logoFallback ?? PODCAST_LOGO_DEFAULT;
}

export function resolvePodcastHosts(idOrName?: string): string[] {
  return findPodcastCatalogEntry(idOrName)?.hosts ?? [];
}

export function resolvePodcastStreams(idOrName?: string): PodcastStreamLinks {
  const entry = findPodcastCatalogEntry(idOrName);
  if (!entry) return {};
  return {
    appleUrl: entry.appleUrl,
    spotifyUrl: entry.spotifyUrl,
    youtubeUrl: entry.youtubeUrl,
    siteUrl: entry.siteUrl,
  };
}

export function catalogPlatformsFromStreams(idOrName?: string): { name: string; url: string }[] {
  const streams = resolvePodcastStreams(idOrName);
  return [
    streams.appleUrl ? { name: 'Apple Podcasts', url: streams.appleUrl } : null,
    streams.spotifyUrl ? { name: 'Spotify', url: streams.spotifyUrl } : null,
    streams.youtubeUrl ? { name: 'YouTube', url: streams.youtubeUrl } : null,
    streams.siteUrl ? { name: 'Website', url: streams.siteUrl } : null,
  ].filter((p): p is { name: string; url: string } => Boolean(p));
}
