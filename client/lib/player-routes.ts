/**
 * Player profile routing — HS recruits vs portal/college vs roster.
 */
export type PlayerRouteKind = 'hs' | 'portal' | 'roster';

export function playerLifecycleKind(lifecycle?: string | null): PlayerRouteKind {
  const lc = String(lifecycle ?? 'HIGH_SCHOOL').toUpperCase();
  if (lc === 'ROSTER') return 'roster';
  if (lc === 'PORTAL' || lc === 'COLLEGE') return 'portal';
  return 'hs';
}

/** Profile path for a player slug based on lifecycle. */
export function playerProfilePath(
  slug: string,
  lifecycle?: string | null,
  inVault = false
): string {
  const safe = encodeURIComponent(slug);
  const kind = playerLifecycleKind(lifecycle);
  if (kind === 'portal') {
    return inVault ? `/vault/portal/player/${safe}` : `/portal/${safe}`;
  }
  if (kind === 'roster') {
    return inVault ? `/vault/players/${safe}` : `/players/${safe}`;
  }
  return inVault ? `/vault/futurecast/player/${safe}` : `/player/${safe}`;
}

/** Scouting DB playerType → profile path. */
export function scoutingProfilePath(slug: string, playerType?: string | null): string {
  const type = String(playerType ?? '').toLowerCase();
  if (type === 'roster') return `/players/${encodeURIComponent(slug)}`;
  if (type === 'portal') return `/portal/${encodeURIComponent(slug)}`;
  return `/player/${encodeURIComponent(slug)}`;
}

