/**
 * Player profile resolution — delegates to /api/player/resolve (no slug guessing).
 */
import {
  fetchFullProfile,
  mapFullProfileToBundle,
  resolvePlayerSlug,
} from './player-full-profile-api';
import type { PlayerProfileBundle } from './player-api';
import type { RosterPlayer } from './roster-api';
import { playerProfilePath } from './player-routes';

export type ProfileResolveResult =
  | { kind: 'futurecast'; slug: string; bundle: PlayerProfileBundle }
  | { kind: 'roster'; slug: string; player: RosterPlayer }
  | { kind: 'redirect'; slug: string; href: string };

export type ProfileResolveOptions = {
  recruitingContext?: boolean;
};

export async function resolvePlayerProfile(
  rawSlug: string,
  inVault = true,
  options?: ProfileResolveOptions
): Promise<ProfileResolveResult> {
  const slug = rawSlug.trim().toLowerCase();
  const context = options?.recruitingContext ? 'recruiting' : inVault ? 'auto' : 'auto';
  const resolved = await resolvePlayerSlug(slug, context);

  if (resolved.redirectHref) {
    return { kind: 'redirect', slug: resolved.canonicalSlug, href: resolved.redirectHref };
  }

  if (resolved.kind === 'roster') {
    return {
      kind: 'roster',
      slug: resolved.canonicalSlug,
      player: resolved.roster as unknown as RosterPlayer,
    };
  }

  const payload = await fetchFullProfile(resolved.canonicalSlug, { playerId: resolved.playerId });
  const bundle = mapFullProfileToBundle(payload);

  if (
    payload.player.status === 'PORTAL' &&
    !options?.recruitingContext &&
    !inVault
  ) {
    return {
      kind: 'redirect',
      slug: resolved.canonicalSlug,
      href: playerProfilePath(resolved.canonicalSlug, 'PORTAL', inVault, undefined, 'recruiting'),
    };
  }

  return { kind: 'futurecast', slug: resolved.canonicalSlug, bundle };
}
