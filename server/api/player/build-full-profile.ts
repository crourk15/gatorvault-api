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
  boardSignalsFromRecruiting,
  competingSchoolsFromRecruiting,
  enrichRelatedFromRecruiting,
  futurecastPicksFromRecruiting,
  futurecastSummaryForRecruiting,
  mergeProfileSignals,
  offerSignalsFromOfferLogs,
  offersFromRecruitingAndLogs,
} from './profile-enrich';
import { relatedPositionsFor } from '../../lib/recruiting-position-buckets';

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
    predictions: Array<{
      school: string;
      score: number;
      sourceType?: string;
      predictorId?: string;
      status?: string;
    }>;
    intel: Record<string, unknown>;
  } | null;
  fitIntel: Record<string, unknown> | null;
  competingSchools: Array<{
    school: string;
    rankNow: number;
    rankPrior: number | null;
    delta: number;
    volatilityBoost: number;
    pct?: number | null;
  }>;
  futurecastSummary: {
    ufProbability: number | null;
    on3UfProbability?: number | null;
    gvProbability?: number | null;
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

  const playerId = String(player.id || intelUuidForSlug(slug));
  let competingSchools = profile.competingSchools ?? [];
  if (!competingSchools.length && recruiting) {
    competingSchools = competingSchoolsFromRecruiting(recruiting);
  }

  // Drop inventory OFFER / RPM interest from DB signals — offers live on HS tab;
  // only known-dated offer logs re-enter the feed via offerSignalsFromOfferLogs.
  let signals = (profile.signals ?? []).filter((s) => {
    const type = String(s.signalType || '').toUpperCase();
    return type !== 'OFFER' && type !== 'COMPETING_INTEREST';
  });
  const offerSignals = offerSignalsFromOfferLogs(playerId, slug);
  const boardSignals = recruiting ? boardSignalsFromRecruiting(playerId, recruiting) : [];
  signals = mergeProfileSignals(signals, offerSignals, signals.length ? [] : boardSignals);

  let portalPredictions = profile.portalPredictions;
  if (!portalPredictions && recruiting) {
    const picks = futurecastPicksFromRecruiting(playerId, recruiting);
    if (picks.length) {
      portalPredictions = {
        predictions: picks,
        intel: {
          portalLikelihood: 0,
          depthChartRisk: 0,
          snapShareScore: 0,
          volatility: 0,
        },
      };
    }
  }

  let highSchoolProfile = profile.highSchoolProfile;
  let ufSpecificProfile = profile.ufSpecificProfile;
  if (recruiting && highSchoolProfile) {
    const stats = (highSchoolProfile.stats as Record<string, unknown>) ?? {};
    // Always rebuild offers so ingest stamps are not shown as real offer dates.
    const offers = offersFromRecruitingAndLogs(slug, recruiting);
    highSchoolProfile = {
      ...highSchoolProfile,
      recruitingNotes:
        highSchoolProfile.recruitingNotes ??
        recruiting.profileNote ??
        recruiting.skinny ??
        null,
      offers,
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

  const hsNote = String(highSchoolProfile?.recruitingNotes || '').trim();
  const evalNote = String(ufSpecificProfile?.evaluationNotes || '').trim();
  if (hsNote && evalNote) {
    const na = hsNote.toLowerCase().replace(/\s+/g, ' ');
    const nb = evalNote.toLowerCase().replace(/\s+/g, ' ');
    if (na === nb || (na.length >= 24 && (na.includes(nb) || nb.includes(na)))) {
      ufSpecificProfile = ufSpecificProfile
        ? { ...ufSpecificProfile, evaluationNotes: null }
        : ufSpecificProfile;
    }
  }

  return {
    ...profile,
    player,
    highSchoolProfile,
    ufSpecificProfile,
    related,
    competingSchools,
    signals,
    portalPredictions,
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
        pct: s.pct,
      }));

      const mw = intel.earlyMovement.movementWindow;
      const on3Uf =
        intel.ufRpmPct != null && Number(intel.ufRpmPct) > 0
          ? Math.round(Number(intel.ufRpmPct))
          : null;
      const boardLeader = [
        ...(on3Uf != null ? [{ school: 'Florida', pct: on3Uf }] : []),
        ...intel.earlyIntel.competingSchools.map((s) => ({ school: s.name, pct: s.pct })),
      ].sort((a, b) => b.pct - a.pct)[0];

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
            sourceType: p.sourceType,
            predictorId: p.predictorId,
            status: p.status,
          })),
          intel: {
            portalLikelihood: 0,
            depthChartRisk: 0,
            snapShareScore: 0,
            volatility: intel.earlyIntel.volatilityScore,
          },
        },
        // Hide proportional filler breakdown until real UF Fit components exist.
        fitIntel: null,
        competingSchools,
        futurecastSummary: {
          // On3 panel: prefer RPM. GV blend stays on FutureCast Picks (Florida row).
          ufProbability: on3Uf ?? intel.earlyIntel.ufProbability,
          on3UfProbability: on3Uf,
          gvProbability: intel.earlyIntel.ufProbability,
          predictedSchool: boardLeader?.school ?? null,
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
    positions: relatedPositionsFor(player.position),
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
