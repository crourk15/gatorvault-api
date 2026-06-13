/**
 * Map recruiting-store players into FutureCast profile shapes when Postgres row is missing.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface FallbackPlayerCore {
  id: string;
  fullName: string;
  slug: string;
  classYear: number;
  position: string;
  status: 'HS' | 'COLLEGE' | 'PORTAL';
  height: number | null;
  weight: number | null;
  hometown: string | null;
  state: string | null;
  highSchool: string | null;
  stars: number | null;
  compositeRating: number | null;
  rankingNational: number | null;
  rankingPosition: number | null;
  rankingState: number | null;
  committedTo: string | null;
  ufFitScore: number | null;
  fitScoreBreakdown: null;
  movementHistory: [];
  volatilityScore: number;
}

type RecruitingPlayer = {
  slug: string;
  name?: string;
  on3Id?: string;
  classYear?: number;
  position?: string;
  category?: string;
  status?: string;
  committedTo?: string;
  stars?: number;
  rating?: number;
  natlRank?: number;
  posRank?: number;
  stateRank?: number;
  height?: string;
  weight?: number;
  hometown?: string;
  state?: string;
  highSchool?: string;
  previousSchool?: string;
  portalStatus?: string;
};

function parseHeight(raw?: string): number | null {
  if (!raw) return null;
  const m = String(raw).match(/(\d)[-']?\s*(\d{1,2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 12 + parseInt(m[2], 10);
}

function lifecycleFromRecruiting(p: RecruitingPlayer): 'HS' | 'COLLEGE' | 'PORTAL' {
  if (p.category === 'portal' || /portal/i.test(String(p.status || ''))) return 'PORTAL';
  if (p.category === 'roster' || /enrolled|roster/i.test(String(p.status || ''))) return 'COLLEGE';
  return 'HS';
}

export async function getRecruitingPlayerBySlug(slug: string): Promise<RecruitingPlayer | null> {
  try {
    const store = require('../../lib/recruiting-store');
    const player = await store.getPlayerBySlug(slug);
    return player || null;
  } catch {
    return null;
  }
}

export function mapRecruitingToPlayerCore(p: RecruitingPlayer): FallbackPlayerCore {
  const lifecycle = lifecycleFromRecruiting(p);
  return {
    id: String(p.on3Id || p.slug),
    fullName: p.name || p.slug,
    slug: p.slug,
    classYear: p.classYear ?? 0,
    position: p.position || 'ATH',
    status: lifecycle,
    height: parseHeight(p.height),
    weight: p.weight ?? null,
    hometown: p.hometown ?? null,
    state: p.state ?? null,
    highSchool: p.highSchool ?? null,
    stars: p.stars ?? null,
    compositeRating: p.rating ?? null,
    rankingNational: p.natlRank ?? null,
    rankingPosition: p.posRank ?? null,
    rankingState: p.stateRank ?? null,
    committedTo: p.committedTo ?? null,
    ufFitScore: null,
    fitScoreBreakdown: null,
    movementHistory: [],
    volatilityScore: 0,
  };
}

export function mapRecruitingProfiles(p: RecruitingPlayer) {
  const lifecycle = lifecycleFromRecruiting(p);
  return {
    highSchoolProfile:
      lifecycle === 'HS'
        ? {
            id: p.slug,
            playerId: String(p.on3Id || p.slug),
            offers: [],
            stats: {},
            recruitingNotes: null,
            discoveryScore: null,
          }
        : null,
    collegeProfile: null,
    portalProfile:
      lifecycle === 'PORTAL'
        ? {
            id: p.slug,
            playerId: String(p.on3Id || p.slug),
            previousSchool: p.previousSchool ?? p.highSchool ?? null,
            enteredPortalAt: null,
            exitedPortalAt: null,
            portalStatus: p.portalStatus || 'ACTIVE',
            destinationSchool: p.committedTo ?? null,
            eligibilityRemaining: null,
            reasonTags: [],
            portalLikelihood: null,
            likelihoodReason: null,
          }
        : null,
    ufSpecificProfile: null,
    signals: [] as [],
    related: [] as [],
  };
}
