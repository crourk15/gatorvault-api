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

function isValidSlug(slug: string | null | undefined): slug is string {
  if (!slug) return false;
  const s = String(slug).trim();
  return s.length > 0 && s !== 'undefined' && s !== 'null';
}

/** Recruiting board row → profile lifecycle (2026 enrollees → roster). */
export function recruitingProfileLifecycle(player: {
  status?: string | null;
  lifecycle?: string | null;
  classYear?: number | null;
}): string {
  const st = String(player.status || '').toLowerCase();
  if (st.includes('enroll') || st.includes('signed')) return 'ROSTER';
  if (player.classYear != null && player.classYear <= 2026 && st.includes('commit')) {
    return 'ROSTER';
  }
  return player.lifecycle || 'HIGH_SCHOOL';
}

/** Profile path for a player slug based on lifecycle. */
export function playerProfilePath(
  slug: string,
  lifecycle?: string | null,
  inVault = false
): string {
  if (!isValidSlug(slug)) {
    return inVault ? '/vault/recruiting-board' : '/recruiting-board';
  }
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

function scoutingTypeToKind(playerType?: string | null): PlayerRouteKind {
  const type = String(playerType ?? '').toLowerCase();
  if (type === 'roster') return 'roster';
  if (type === 'portal') return 'portal';
  return 'hs';
}

/** Scouting DB playerType → profile path. */
export function scoutingProfilePath(
  slug: string,
  playerType?: string | null,
  inVault = false
): string {
  const kind = scoutingTypeToKind(playerType);
  const safe = encodeURIComponent(slug);
  if (kind === 'portal') {
    return inVault ? `/vault/portal/player/${safe}` : `/portal/${safe}`;
  }
  if (kind === 'roster') {
    return inVault ? `/vault/players/${safe}` : `/players/${safe}`;
  }
  return inVault ? `/vault/futurecast/player/${safe}` : `/player/${safe}`;
}

