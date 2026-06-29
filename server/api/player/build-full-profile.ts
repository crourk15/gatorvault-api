/**
 * Aggregated player profile — single round-trip for profile pages.
 */
import { createRequire } from 'node:module';
import { buildBigBoard } from '../big-board/engine';
import { buildFitScoreBreakdown } from '../players/fit-breakdown';
import {
  getRecruitingPlayerBySlug,
  mapRecruitingProfiles,
  mapRecruitingToPlayerCore,
} from '../players/recruiting-fallback';
import {
  serializeFullPlayer,
  serializeProfile,
  serializeSignal,
} from '../players/utils';
import { listBigBoardPlayers } from '../../models/big-board';
import { listCompetingSchoolsForPlayer } from '../../models/competing-school-history';
import { listDiscoverySignalsByPlayerId } from '../../models/discovery-signal';
import { getCollegeProfileByPlayerId } from '../../models/college-profile';
import { getHighSchoolProfileByPlayerId } from '../../models/highschool-profile';
import { getPlayerById } from '../../models/player';
import { resolvePostgresPlayerBySlug } from '../../models/player-slug';
import { getPortalProfileByPlayerId } from '../../models/portal-profile';
import {
  getRollingMovementForPlayer,
  listMovementHistoryByPlayerId,
  listPredictionsByPlayerId,
  movementHistoryFromRows,
  recentMovementHistory,
  ROLLING_MOVEMENT_WINDOW_DAYS,
} from '../../models/predictions';
import { getUFSpecificProfileByPlayerId } from '../../models/uf-specific-profile';
import {
  getPortalIntelByPlayerId,
  listPeerPortalDestinations,
  portalRowToEngineInput,
} from '../../models/portal-intel';
import {
  computePortalIntelScores,
  computePortalLikelihoodTrend,
  computeTransferPredictions,
} from '../portal/engine';
import { getUfFitIntelByPlayerId, ufFitRowToEngineInput } from '../../models/uf-fit-intel';
import { computeUfFitIntel } from '../uf-fit/engine';
import {
  buildUnderclassmenIntelForSlug,
  intelUuidForSlug,
  isUnderclassmenClassYear,
} from '../../lib/underclassmen-intel';
import {
  augmentPlayerFromRecruiting,
  enrichRelatedFromRecruiting,
  futurecastSummaryForRecruiting,
} from './profile-enrich';

const require = createRequire(import.meta.url);

export type FullProfileSource = 'postgres' | 'recruiting-store';

export interface FullProfileResponse {
  lastUpdated: string;
  source: FullProfileSource;
  player: Record<string, unknown>;
  highSchoolProfile: Record<string, unknown> | null;
  collegeProfile: Record<string, unknown> | null;
  portalProfile: Record<string, unknown> | null;
  ufSpecificProfile: Record<string, unknown> | null;
  movementWindow: {
    ufProbNow: number;
    ufProb7dAgo: number;
    delta7d: number;
    volatilityScore: number;
    windowDays: number;
  } | null;
  movementHistory: Array<{ date: string; confidence: number }>;
  signals: Record<string, unknown>[];
  related: Record<string, unknown>[];
  portalPredictions: {
    predictions: Array<{ school: string; score: number }>;
    intel: Record<string, unknown>;
  } | null;
  fitIntel: Record<string, unknown> | null;
  competingSchools: Array<{
    school: string;
    rankNow: number;
    rankPrior: number | null;
    delta: number;
    volatilityBoost: number;
  }>;
  futurecastSummary: {
    ufProbability: number | null;
    predictedSchool: string | null;
    movementDelta: number | null;
    fitScore: number | null;
    volatilityScore: number | null;
  } | null;
}

function rosterPlayerBySlug(slug: string): Record<string, unknown> | null {
  try {
    const rosterStore = require('../../lib/roster-store');
    const player = rosterStore.getRosterPlayerBySlug(slug);
    return player || null;
  } catch {
    return null;
  }
}

async function safeResolvePostgresPlayerBySlug(
  slug: string
): Promise<{ playerId: string; canonicalSlug: string } | null> {
  try {
    return await resolvePostgresPlayerBySlug(slug);
  } catch (err) {
    console.warn(
      '[player-profile] Postgres slug resolve failed, using recruiting store fallback:',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

async function finalizeProfileResponse(
  slug: string,
  profile: FullProfileResponse
): Promise<FullProfileResponse> {
  const recruiting = await getRecruitingPlayerBySlug(slug);
  const player = await augmentPlayerFromRecruiting(
    slug,
    profile.player as Record<string, unknown>
  );
  const related = await enrichRelatedFromRecruiting(profile.related);
  const futurecastSummary = futurecastSummaryForRecruiting(
    player,
    recruiting,
    (profile.futurecastSummary as Record<string, unknown> | null) ?? null
  );

  let highSchoolProfile = profile.highSchoolProfile;
  if (recruiting && highSchoolProfile) {
    const stats = (highSchoolProfile.stats as Record<string, unknown>) ?? {};
    highSchoolProfile = {
      ...highSchoolProfile,
      recruitingNotes:
        highSchoolProfile.recruitingNotes ??
        recruiting.profileNote ??
        recruiting.skinny ??
        null,
      stats: {
        ...stats,
        stars: stats.stars ?? recruiting.stars ?? null,
        natlRank: stats.natlRank ?? recruiting.natlRank ?? null,
        posRank: stats.posRank ?? recruiting.posRank ?? null,
        stateRank: stats.stateRank ?? recruiting.stateRank ?? null,
        rating: stats.rating ?? recruiting.rating ?? null,
        on3Id: stats.on3Id ?? recruiting.on3Id ?? null,
      },
    };
  }

  return {
    ...profile,
    player,
    highSchoolProfile,
    related,
    futurecastSummary: futurecastSummary as FullProfileResponse['futurecastSummary'],
  };
}

async function buildRecruitingStoreProfile(slug: string): Promise<FullProfileResponse | null> {
  const recruiting = await getRecruitingPlayerBySlug(slug);
  if (!recruiting) return null;

  const player = mapRecruitingToPlayerCore(recruiting);
  const profiles = mapRecruitingProfiles(recruiting);
  const now = new Date().toISOString();
  const classYear = player.classYear;

  if (isUnderclassmenClassYear(classYear)) {
    const intel = await buildUnderclassmenIntelForSlug(slug);
    if (intel) {
      player.id = intel.intelUuid;
      player.ufFitScore = intel.earlyIntel.fitScore;
      player.volatilityScore = intel.earlyIntel.volatilityScore;
      player.movementHistory = intel.earlyMovement.movementHistory;

      const hsProfile = profiles.highSchoolProfile as Record<string, unknown> | null;
      if (hsProfile) {
        hsProfile.playerId = intel.intelUuid;
        hsProfile.discoveryScore = intel.earlyIntel.discoveryScore;
      }

      const related = intel.relatedIntel.map((r, i) => ({
        id: r.id,
        slug: r.slug,
        fullName: r.fullName,
        classYear: r.classYear,
        position: r.position,
        lifecycle: 'HS',
        portalStatus: null,
        signalCount: 0,
        portalLikelihood: 0,
        ufFitScore: r.fitScore,
        ufConfidence: r.ufConfidence,
        rank: i + 1,
      }));

      const competingSchools = intel.earlyIntel.competingSchools.map((s, i) => ({
        school: s.name,
        rankNow: i + 1,
        rankPrior: null,
        delta: 0,
        volatilityBoost: 0,
      }));

      const mw = intel.earlyMovement.movementWindow;

      return finalizeProfileResponse(slug, {
        lastUpdated: intel.updatedAt || now,
        source: 'recruiting-store',
        player: player as unknown as Record<string, unknown>,
        highSchoolProfile: profiles.highSchoolProfile as Record<string, unknown> | null,
        collegeProfile: profiles.collegeProfile,
        portalProfile: profiles.portalProfile as Record<string, unknown> | null,
        ufSpecificProfile: profiles.ufSpecificProfile,
        movementWindow: mw,
        movementHistory: intel.earlyMovement.movementHistory,
        signals: intel.earlySignals as unknown as Record<string, unknown>[],
        related,
        portalPredictions: {
          predictions: intel.earlyFutureCastPicks.map((p) => ({
            school: p.school,
            score: p.confidence,
          })),
          intel: {
            portalLikelihood: 0,
            depthChartRisk: 0,
            snapShareScore: 0,
            volatility: intel.earlyIntel.volatilityScore,
          },
        },
        fitIntel: {
          ufFitScore: intel.earlyIntel.fitScore,
          fitTier:
            intel.earlyIntel.fitScore >= 85
              ? 'elite'
              : intel.earlyIntel.fitScore >= 70
                ? 'strong'
                : intel.earlyIntel.fitScore >= 50
                  ? 'moderate'
                  : 'low',
          schemeFit: Math.round(intel.earlyIntel.fitScore * 0.4),
          cultureFit: Math.round(intel.earlyIntel.fitScore * 0.3),
          positionalNeed: Math.round(intel.earlyIntel.fitScore * 0.2),
          staffInterest: Math.round(intel.earlyIntel.fitScore * 0.1),
          fitDelta: intel.earlyMovement.trendDelta7d * 100,
          fitVolatility: intel.earlyIntel.volatilityScore,
          history: [],
        },
        competingSchools,
        futurecastSummary: {
          ufProbability: intel.earlyIntel.ufProbability,
          predictedSchool: 'Florida',
          movementDelta: mw?.delta7d ?? null,
          fitScore: intel.earlyIntel.fitScore,
          volatilityScore: intel.earlyIntel.volatilityScore,
        },
      });
    }

    player.id = intelUuidForSlug(slug);
  }

  return finalizeProfileResponse(slug, {
    lastUpdated: now,
    source: 'recruiting-store',
    player: player as unknown as Record<string, unknown>,
    highSchoolProfile: profiles.highSchoolProfile as Record<string, unknown> | null,
    collegeProfile: profiles.collegeProfile,
    portalProfile: profiles.portalProfile as Record<string, unknown> | null,
    ufSpecificProfile: profiles.ufSpecificProfile,
    movementWindow: null,
    movementHistory: [],
    signals: [],
    related: [],
    portalPredictions: null,
    fitIntel: null,
    competingSchools: [],
    futurecastSummary: null,
  });
}

export async function buildFullProfileBySlug(slug: string): Promise<FullProfileResponse | null> {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;

  try {
    const resolved = await safeResolvePostgresPlayerBySlug(normalized);
    if (!resolved) {
      return buildRecruitingStoreProfile(normalized);
    }

    const { playerId } = resolved;
    const player = await getPlayerById(playerId);
    if (!player) {
      return buildRecruitingStoreProfile(normalized);
    }

  const [
    highSchoolProfile,
    collegeProfile,
    portalProfile,
    ufSpecificProfile,
    movementHistoryRows,
    signals,
    portalIntelRow,
    ufFitRow,
    competingSchools,
    predictions,
  ] = await Promise.all([
    getHighSchoolProfileByPlayerId(playerId),
    getCollegeProfileByPlayerId(playerId),
    getPortalProfileByPlayerId(playerId),
    getUFSpecificProfileByPlayerId(playerId),
    listMovementHistoryByPlayerId(playerId),
    listDiscoverySignalsByPlayerId(playerId, 100),
    getPortalIntelByPlayerId(playerId).catch(() => null),
    getUfFitIntelByPlayerId(playerId).catch(() => null),
    listCompetingSchoolsForPlayer(playerId, ROLLING_MOVEMENT_WINDOW_DAYS),
    listPredictionsByPlayerId(playerId),
  ]);

  const competingBoost = competingSchools.reduce(
    (max, row) => Math.max(max, row.volatilityBoost),
    0
  );
  const movementWindow = await getRollingMovementForPlayer(playerId, competingBoost);
  const movementHistory = movementHistoryFromRows(recentMovementHistory(movementHistoryRows));

  const fitScoreBreakdown = buildFitScoreBreakdown(player, ufSpecificProfile);

  const serializedPlayer = {
    ...serializeFullPlayer(player),
    ufFitScore: ufSpecificProfile?.uf_fit_score ?? null,
    fitScoreBreakdown,
    movementHistory,
    volatilityScore: movementWindow?.volatilityScore ?? 0,
  };

  let portalPredictions: FullProfileResponse['portalPredictions'] = null;
  if (
    portalIntelRow &&
    (player.status === 'COLLEGE' || player.status === 'PORTAL' || portalProfile)
  ) {
    try {
      const input = portalRowToEngineInput(portalIntelRow);
      const peerDestinations = await listPeerPortalDestinations(portalIntelRow.previous_school);
      const predictionsList = computeTransferPredictions(input, peerDestinations);
      const scores = computePortalIntelScores(input);
      const trend = computePortalLikelihoodTrend(input, 30);
      portalPredictions = {
        predictions: predictionsList,
        intel: {
          portalLikelihood: scores.portalLikelihood,
          depthChartRisk: scores.depthChartRisk,
          snapShareScore: scores.snapShareScore,
          snapShare: scores.snapShare,
          volatility: scores.volatility,
          likelihoodTrend: trend,
        },
      };
    } catch {
      portalPredictions = null;
    }
  }

  let fitIntel: FullProfileResponse['fitIntel'] = null;
  if (ufFitRow) {
    try {
      fitIntel = computeUfFitIntel(ufFitRowToEngineInput(ufFitRow)) as unknown as Record<
        string,
        unknown
      >;
    } catch {
      fitIntel = null;
    }
  }

  const rows = await listBigBoardPlayers({
    class_year: player.class_year,
    position: player.position,
  });
  const ranked = buildBigBoard(rows, 'rank', 'desc', rows.length);
  const related = ranked
    .filter((p) => p.id !== playerId)
    .slice(0, 6)
    .map((p) => p as unknown as Record<string, unknown>);

  const active = predictions.find((p) => p.status === 'ACTIVE' && p.source_type === 'MODEL');

  const futurecastSummary = active
    ? {
        ufProbability: active.confidence,
        predictedSchool: active.school,
        movementDelta: movementWindow?.delta7d ?? null,
        fitScore: ufSpecificProfile?.uf_fit_score ?? null,
        volatilityScore: movementWindow?.volatilityScore ?? null,
      }
    : null;

  const updatedAt = [
    player.updated_at,
    active?.updated_at,
  ]
    .filter(Boolean)
    .map((v) => new Date(String(v)).getTime())
    .filter((t) => Number.isFinite(t));
  const lastUpdated = updatedAt.length
    ? new Date(Math.max(...updatedAt)).toISOString()
    : new Date().toISOString();

  return finalizeProfileResponse(normalized, {
    lastUpdated,
    source: 'postgres',
    player: serializedPlayer,
    highSchoolProfile: serializeProfile(
      highSchoolProfile as unknown as Record<string, unknown> | null
    ),
    collegeProfile: serializeProfile(collegeProfile as unknown as Record<string, unknown> | null),
    portalProfile: serializeProfile(portalProfile as unknown as Record<string, unknown> | null),
    ufSpecificProfile: serializeProfile(
      ufSpecificProfile as unknown as Record<string, unknown> | null
    ),
    movementWindow: movementWindow
      ? {
          ufProbNow: movementWindow.ufProbNow,
          ufProb7dAgo: movementWindow.ufProb7dAgo,
          delta7d: movementWindow.delta7d,
          volatilityScore: movementWindow.volatilityScore,
          windowDays: ROLLING_MOVEMENT_WINDOW_DAYS,
        }
      : null,
    movementHistory,
    signals: signals.map((s) =>
      serializeSignal(s as unknown as Record<string, unknown>)
    ),
    related,
    portalPredictions,
    fitIntel,
    competingSchools,
    futurecastSummary,
  });
  } catch (err) {
    console.warn(
      '[player-profile] Postgres full profile failed, using recruiting store fallback:',
      err instanceof Error ? err.message : err
    );
    return buildRecruitingStoreProfile(normalized);
  }
}

export type ResolveKind = 'futurecast' | 'roster' | 'recruiting-fallback';

export interface ResolvePlayerResponse {
  kind: ResolveKind;
  playerId: string;
  canonicalSlug: string;
  redirectHref: string | null;
  roster: Record<string, unknown> | null;
}

export async function resolvePlayerSlugRecord(
  slug: string,
  context: 'recruiting' | 'futurecast' | 'roster' | 'auto' = 'auto'
): Promise<ResolvePlayerResponse | null> {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;

  try {
    const postgres = await safeResolvePostgresPlayerBySlug(normalized);
    if (postgres) {
      const player = await getPlayerById(postgres.playerId);
      if (player) {
        let redirectHref: string | null = null;
        if (player.status === 'PORTAL' && context !== 'recruiting') {
          redirectHref = `/vault/recruiting/player/${encodeURIComponent(player.slug)}/`;
        }
        return {
          kind: 'futurecast',
          playerId: player.id,
          canonicalSlug: player.slug,
          redirectHref,
          roster: null,
        };
      }
    }
  } catch (err) {
    console.warn(
      '[player-profile] Postgres resolve failed, using recruiting store fallback:',
      err instanceof Error ? err.message : err
    );
  }

  const recruiting = await getRecruitingPlayerBySlug(normalized);
  if (recruiting) {
    const classYear = Number(recruiting.classYear ?? 0);
    const playerId =
      isUnderclassmenClassYear(classYear)
        ? intelUuidForSlug(normalized)
        : String(recruiting.on3Id || recruiting.slug);
    return {
      kind: 'recruiting-fallback',
      playerId,
      canonicalSlug: recruiting.slug,
      redirectHref: null,
      roster: null,
    };
  }

  const roster = rosterPlayerBySlug(normalized);
  if (roster) {
    if (context === 'recruiting' || context === 'futurecast') {
      return {
        kind: 'roster',
        playerId: String(roster.slug || normalized),
        canonicalSlug: String(roster.slug || normalized),
        redirectHref: `/vault/players/${encodeURIComponent(String(roster.slug || normalized))}/`,
        roster,
      };
    }
    return {
      kind: 'roster',
      playerId: String(roster.slug || normalized),
      canonicalSlug: String(roster.slug || normalized),
      redirectHref: null,
      roster,
    };
  }

  return null;
}
