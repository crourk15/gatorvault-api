/**
 * Player profile routing — HS recruits vs portal/college players.
 */
export type PlayerRouteKind = 'hs' | 'portal';

export function playerLifecycleKind(lifecycle?: string | null): PlayerRouteKind {
  const lc = String(lifecycle ?? 'HS').toUpperCase();
  return lc === 'PORTAL' || lc === 'COLLEGE' ? 'portal' : 'hs';
}

/** Profile path for a player slug based on lifecycle. */
export function playerProfilePath(slug: string, lifecycle?: string | null): string {
  const safe = encodeURIComponent(slug);
  return playerLifecycleKind(lifecycle) === 'portal' ? `/portal/${safe}` : `/player/${safe}`;
}

/** Scouting DB playerType → profile path. */
export function scoutingProfilePath(slug: string, playerType?: string | null): string {
  const type = String(playerType ?? '').toLowerCase();
  if (type === 'portal' || type === 'roster') return `/portal/${encodeURIComponent(slug)}`;
  return `/player/${encodeURIComponent(slug)}`;
}
