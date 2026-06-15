/**
 * Multi-source player profile resolution — FutureCast, roster, recruiting store.
 */
import {
  fetchPlayerProfile,
  type PlayerProfileBundle,
} from './player-api';
import { fetchRosterPlayerBySlug, type RosterPlayer } from './roster-api';
import { fetchRecruitingBoard, type RecruitingBoardPlayer } from './recruiting-board-api';
import { ensurePlayerSlug, isValidSlug, slugify } from './slug';
import { playerLifecycleKind, playerProfilePath } from './player-routes';

export type ProfileResolveResult =
  | { kind: 'futurecast'; slug: string; bundle: PlayerProfileBundle }
  | { kind: 'roster'; slug: string; player: RosterPlayer }
  | { kind: 'redirect'; slug: string; href: string };

export type ProfileResolveOptions = {
  /** When true, stay on recruiting profile route — do not bounce to roster. */
  recruitingContext?: boolean;
};

async function findRecruitingBoardPlayer(rawSlug: string): Promise<RecruitingBoardPlayer | null> {
  const needle = rawSlug.trim().toLowerCase();
  for (const classYear of [2027, 2028]) {
    try {
      const board = await fetchRecruitingBoard(classYear);
      const pool = [
        ...(board.commits ?? []),
        ...(board.targets ?? []),
        ...(board.players ?? []),
      ];
      const match = pool.find((p) => {
        const s = ensurePlayerSlug(p.slug, p.name).toLowerCase();
        return s === needle || slugify(p.name) === needle;
      });
      if (match) return match;
    } catch {
      /* try next class year */
    }
  }
  return null;
}

/** Resolve profile from slug or name; tries alternate slug forms. */
export async function resolvePlayerProfile(
  rawSlug: string,
  inVault = true,
  options?: ProfileResolveOptions
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
        const href = playerProfilePath(slug, 'PORTAL', inVault, undefined, 'recruiting');
        if (!inVault || !window.location.pathname.includes('/recruiting/player/')) {
          return { kind: 'redirect', slug, href };
        }
      }
      return { kind: 'futurecast', slug, bundle };
    } catch {
      /* try next source */
    }

    if (!options?.recruitingContext) {
      try {
        const roster = await fetchRosterPlayerBySlug(slug);
        if (roster) {
          return { kind: 'roster', slug, player: roster };
        }
      } catch {
        /* continue */
      }
    }
  }

  if (options?.recruitingContext) {
    const boardPlayer = await findRecruitingBoardPlayer(candidates[0] ?? rawSlug);
    if (boardPlayer) {
      const slug = ensurePlayerSlug(boardPlayer.slug, boardPlayer.name);
      try {
        const bundle = await fetchPlayerProfile(slug);
        return { kind: 'futurecast', slug, bundle };
      } catch {
        throw new Error(`Profile for ${boardPlayer.name || slug} is not available yet.`);
      }
    }
  }

  throw new Error('Player not found — check the recruiting board or roster for this profile.');
}
