/**
 * Player profile routing — HS recruits vs portal/college vs roster.
 */
import { ensurePlayerSlug, isValidSlug } from './slug';

export type PlayerRouteKind = 'hs' | 'portal' | 'roster';

export function playerLifecycleKind(lifecycle?: string | null): PlayerRouteKind {
  const lc = String(lifecycle ?? 'HIGH_SCHOOL').toUpperCase();
  if (lc === 'ROSTER') return 'roster';
  if (lc === 'PORTAL' || lc === 'COLLEGE') return 'portal';
  return 'hs';
}

export function isPortalRecruit(player: {
  lifecycle?: string | null;
  category?: string | null;
  status?: string | null;
}): boolean {
  const lc = String(player.lifecycle ?? '').toUpperCase();
  const cat = String(player.category ?? '').toLowerCase();
  const st = String(player.status ?? '').toLowerCase();
  return lc === 'PORTAL' || cat === 'portal' || st.includes('portal');
}

/** Recruiting board row → profile lifecycle. */
export function recruitingProfileLifecycle(player: {
  status?: string | null;
  lifecycle?: string | null;
  classYear?: number | null;
  category?: string | null;
  isCommittedToUF?: boolean;
}): string {
  if (isPortalRecruit(player)) return 'PORTAL';
  const st = String(player.status || '').toLowerCase();
  if (st.includes('enroll') || st.includes('signed')) return 'ROSTER';
  if (player.isCommittedToUF && player.classYear != null && player.classYear <= 2026) {
    return 'ROSTER';
  }
  if (player.classYear != null && player.classYear <= 2026 && st.includes('commit')) {
    return 'ROSTER';
  }
  return player.lifecycle || 'HIGH_SCHOOL';
}

/** Profile path for a player slug based on lifecycle. */
export function playerProfilePath(
  slug: string | null | undefined,
  lifecycle?: string | null,
  inVault = false,
  name?: string | null
): string {
  const resolved = ensurePlayerSlug(slug, name);
  if (!isValidSlug(resolved)) {
    return inVault ? '/vault/recruiting' : '/recruiting-board';
  }
  const safe = encodeURIComponent(resolved);
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

function kindToLifecycle(kind: PlayerRouteKind): string {
  if (kind === 'roster') return 'ROSTER';
  if (kind === 'portal') return 'PORTAL';
  return 'HIGH_SCHOOL';
}

/** Scouting DB playerType → profile path. */
export function scoutingProfilePath(
  slug: string,
  playerType?: string | null,
  inVault = false,
  name?: string | null
): string {
  const resolved = ensurePlayerSlug(slug, name);
  return playerProfilePath(resolved, kindToLifecycle(scoutingTypeToKind(playerType)), inVault, name);
}

/** Filter portal players out of commit/target lists. */
export function filterRecruitingHsOnly<T extends { lifecycle?: string | null; category?: string | null; status?: string | null }>(
  list: T[]
): T[] {
  return list.filter((p) => !isPortalRecruit(p));
}
