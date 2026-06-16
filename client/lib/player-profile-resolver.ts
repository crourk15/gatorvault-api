/**
 * Multi-source player profile resolution — FutureCast, roster, recruiting store.
 */
import {
  fetchPlayerProfile,
  type PlayerCore,
  type PlayerProfileBundle,
} from './player-api';
import { fetchRosterPlayerBySlug, type RosterPlayer } from './roster-api';
import { fetchRecruitingBoard, type RecruitingBoardPlayer } from './recruiting-board-api';
import { coerceDisplayText } from './coerce-text';
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

function parseHtWt(htWt?: string | null): { height: number | null; weight: number | null } {
  if (!htWt) return { height: null, weight: null };
  const m = htWt.match(/(\d)[-'](\d{1,2}).*?(\d{2,3})/);
  if (!m) return { height: null, weight: null };
  return {
    height: parseInt(m[1], 10) * 12 + parseInt(m[2], 10),
    weight: parseInt(m[3], 10),
  };
}

function boardPlayerToBundle(player: RecruitingBoardPlayer): PlayerProfileBundle {
  const slug = ensurePlayerSlug(player.slug, player.name);
  const { height, weight } = parseHtWt(player.htWt);
  const notes = coerceDisplayText(
    player.evaluatorNotes ?? player.skinny ?? player.profileNote ?? player.notes
  );
  const core: PlayerCore = {
    id: slug,
    fullName: player.name,
    slug,
    classYear: player.classYear ?? 2027,
    position: player.pos ?? player.position ?? 'ATH',
    status: 'HS',
    height,
    weight,
    hometown: player.school ?? null,
    state: player.state ?? null,
    highSchool: player.school ?? null,
    stars: player.stars ?? null,
    compositeRating: player.rating ?? player.displayRating ?? null,
    rankingNational: player.natlRank ?? player.natl ?? null,
    rankingPosition: player.posRank ?? null,
    rankingState: player.stateRank ?? null,
    committedTo: player.committedTo ?? 'Florida',
    ufFitScore: player.fitScore ?? null,
    fitScoreBreakdown: null,
    movementHistory: [],
    volatilityScore: 0,
  };

  return {
    player: core,
    highSchoolProfile: {
      id: slug,
      playerId: slug,
      offers: [],
      stats: {},
      recruitingNotes: notes,
      discoveryScore: null,
    },
    collegeProfile: null,
    portalProfile: null,
    ufSpecificProfile: notes
      ? {
          id: slug,
          playerId: slug,
          ufFitScore: player.fitScore ?? null,
          athleticScore: null,
          schemeScore: null,
          characterScore: null,
          timelineScore: null,
          ufStatus: player.isCommittedToUF ? 'COMMITTED' : null,
          ufCommitProbability: player.ufProbability ?? null,
          evaluationNotes: notes,
          tags: [],
          metadata: {
            strengths: player.strengths ?? [],
            weaknesses: player.weaknesses ?? [],
          },
        }
      : null,
    signals: [],
    related: [],
  };
}

async function findRecruitingBoardPlayer(rawSlug: string): Promise<RecruitingBoardPlayer | null> {
  const needle = rawSlug.trim().toLowerCase();
  for (const classYear of [2026, 2027, 2028]) {
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
        return { kind: 'futurecast', slug, bundle: boardPlayerToBundle(boardPlayer) };
      }
    }
  }

  throw new Error('Player not found — check the recruiting board or roster for this profile.');
}
