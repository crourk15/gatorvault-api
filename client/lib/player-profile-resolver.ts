/**
 * Multi-source player profile resolution — FutureCast, roster, recruiting store.
 */
import { getApiBase } from './big-board-api';
import {
  fetchPlayerProfile,
  type PlayerProfileBundle,
} from './player-api';
import { fetchRosterPlayerBySlug, type RosterPlayer } from './roster-api';
import { ensurePlayerSlug, isValidSlug, slugify } from './slug';
import { playerLifecycleKind, playerProfilePath } from './player-routes';

export type ProfileResolveResult =
  | { kind: 'futurecast'; slug: string; bundle: PlayerProfileBundle }
  | { kind: 'roster'; slug: string; player: RosterPlayer }
  | { kind: 'redirect'; slug: string; href: string };

async function tryRecruitingStoreSlug(rawSlug: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${getApiBase()}/api/recruiting/board?class=2027&limit=1`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      players?: { slug?: string; name?: string }[];
      commits?: { slug?: string; name?: string }[];
      targets?: { slug?: string; name?: string }[];
    };
    const all = [...(data.commits ?? []), ...(data.targets ?? []), ...(data.players ?? [])];
    const match = all.find(
      (p) =>
        p.slug === rawSlug ||
        slugify(p.name) === rawSlug ||
        slugify(p.slug) === rawSlug
    );
    return match ? ensurePlayerSlug(match.slug, match.name) : null;
  } catch {
    return null;
  }
}

/** Resolve profile from slug or name; tries alternate slug forms. */
export async function resolvePlayerProfile(
  rawSlug: string,
  inVault = true
): Promise<ProfileResolveResult> {
  const candidates = [
    rawSlug.trim().toLowerCase(),
    slugify(rawSlug),
    ensurePlayerSlug(rawSlug),
  ].filter((s, i, arr) => s && arr.indexOf(s) === i);

  for (const slug of candidates) {
    if (!isValidSlug(slug)) continue;
    try {
      const bundle = await fetchPlayerProfile(slug);
      const kind = playerLifecycleKind(bundle.player.status);
      if (kind === 'portal') {
        const href = playerProfilePath(slug, 'PORTAL', inVault);
        if (!inVault || !window.location.pathname.includes('/portal/')) {
          return { kind: 'redirect', slug, href };
        }
      }
      return { kind: 'futurecast', slug, bundle };
    } catch {
      /* try next source */
    }

    try {
      const roster = await fetchRosterPlayerBySlug(slug);
      if (roster) {
        return { kind: 'roster', slug, player: roster };
      }
    } catch {
      /* continue */
    }
  }

  const storeSlug = await tryRecruitingStoreSlug(candidates[0] ?? rawSlug);
  if (storeSlug && storeSlug !== candidates[0]) {
    return resolvePlayerProfile(storeSlug, inVault);
  }

  throw new Error('Player not found — check the recruiting board or roster for this profile.');
}
