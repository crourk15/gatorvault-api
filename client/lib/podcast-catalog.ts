/**
 * Canonical podcast metadata — logo paths and host names for Podcast Hub surfaces.
 * Drop PNG assets at /public/images/podcasts/*.png (SVG fallbacks ship until then).
 */

export type PodcastCatalogEntry = {
  id: string;
  name: string;
  logoUrl: string;
  logoFallback: string;
  hosts: string[];
};

export const PODCAST_CATALOG: PodcastCatalogEntry[] = [
  {
    id: 'gators-breakdown',
    name: 'Gators Breakdown',
    logoUrl: '/images/podcasts/gators-breakdown.png',
    logoFallback: '/images/podcasts/gators-breakdown.svg',
    hosts: ['David Waters'],
  },
  {
    id: 'gators-online',
    name: 'Gators Online Podcast',
    logoUrl: '/images/podcasts/gators-online.png',
    logoFallback: '/images/podcasts/gators-online.svg',
    hosts: ['On3 Florida'],
  },
  {
    id: 'gnfp',
    name: 'Gator Nation Football Podcast',
    logoUrl: '/images/podcasts/gnfp.png',
    logoFallback: '/images/podcasts/gnfp.svg',
    hosts: ['GNFP'],
  },
  {
    id: 'gator-tales',
    name: 'Gator Tales',
    logoUrl: '/images/podcasts/gator-tales.png',
    logoFallback: '/images/podcasts/gator-tales.svg',
    hosts: ['Sean Kelley'],
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
