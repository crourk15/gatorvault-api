/**
 * Map recruiting-store players into FutureCast profile shapes when Postgres row is missing.
 */
import { createRequire } from 'node:module';
import { intelUuidForSlug, isUnderclassmenClassYear } from '../../lib/underclassmen-intel';

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
  htWt?: string;
  fitScore?: number;
  profileNote?: string;
  skinny?: string;
  ufRpmPct?: number;
  ufProbability?: number;
  offers?: string[];
  visits?: Array<{ date?: string; school?: string; type?: string }>;
  interestMeter?: string;
  hometown?: string;
  pos?: string;
  highSchool?: string;
  previousSchool?: string;
  portalStatus?: string;
};

function parseHtWt(htWt?: string): { height: string | null; weight: number | null } {
  const raw = String(htWt || '');
  const m = raw.match(/(\d-\d+)\s*\/\s*(\d+)/);
  if (!m) return { height: null, weight: null };
  return { height: m[1], weight: Number(m[2]) };
}

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
    const resolve =
      typeof store.resolvePlayerKey === 'function'
        ? store.resolvePlayerKey.bind(store)
        : store.getPlayerBySlug.bind(store);
    const player = await resolve(String(slug || '').trim());
    return player || null;
  } catch (err) {
    console.warn(
      '[recruiting-fallback] player lookup failed:',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export function mapRecruitingToPlayerCore(p: RecruitingPlayer): FallbackPlayerCore {
  const lifecycle = lifecycleFromRecruiting(p);
  const classYear = p.classYear ?? 0;
  const id =
    isUnderclassmenClassYear(classYear)
      ? intelUuidForSlug(p.slug)
      : String(p.on3Id || p.slug);
  const parsed = parseHtWt(p.htWt);
  const heightInches = parseHeight(p.height || parsed.height || undefined);
  const weight = p.weight ?? parsed.weight ?? null;
  const ufProb = p.ufProbability != null ? Number(p.ufProbability) : null;
  const fit = p.fitScore != null ? Number(p.fitScore) : null;

  return {
    id,
    fullName: p.name || p.slug,
    slug: p.slug,
    classYear: p.classYear ?? 0,
    position: p.position || p.pos || 'ATH',
    status: lifecycle,
    height: heightInches,
    weight,
    hometown: p.hometown ?? null,
    state: p.state ?? null,
    highSchool: p.highSchool ?? null,
    stars: p.stars ?? null,
    compositeRating: p.rating ?? null,
    rankingNational: p.natlRank ?? null,
    rankingPosition: p.posRank ?? null,
    rankingState: p.stateRank ?? null,
    committedTo: p.committedTo ?? null,
    ufFitScore: fit,
    fitScoreBreakdown: null,
    movementHistory: [],
    volatilityScore: 0,
  };
}

export function mapRecruitingProfiles(p: RecruitingPlayer) {
  const lifecycle = lifecycleFromRecruiting(p);
  const classYear = p.classYear ?? 0;
  const playerId =
    isUnderclassmenClassYear(classYear)
      ? intelUuidForSlug(p.slug)
      : String(p.on3Id || p.slug);
  return {
    highSchoolProfile:
      lifecycle === 'HS'
        ? {
            id: p.slug,
            playerId,
            offers: Array.isArray(p.offers) ? p.offers : [],
            stats: {},
            recruitingNotes: null,
            discoveryScore: null,
            visitHistory: Array.isArray(p.visits) ? p.visits : [],
            interestMeter: p.interestMeter ?? null,
          }
        : null,
    collegeProfile: null,
    portalProfile:
      lifecycle === 'PORTAL'
        ? {
            id: p.slug,
            playerId,
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
