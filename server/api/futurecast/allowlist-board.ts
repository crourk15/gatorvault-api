/**
 * FutureCast board data — ONLY verified 2027 allow-list players.
 * Player card metrics: see client/lib/futurecast-elite-metrics.ts
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calculateVolatility,
  listMovementHistoryByPlayerIds,
  listPredictions,
  listStockBoardRows,
  VOLATILITY_WINDOW_DAYS,
} from '../../models/predictions';
import { loadRecruitingRankings } from '../../lib/load-recruiting-rankings';
import {
  dedupeFeedRows,
  filterModelPredictionsOnly,
  filterMovementIntelStockRows,
  filterTrendingStockRows,
  FUTURECAST_CLASS_YEAR,
} from './feed-filters';
import { serializeFeedRowsWithVolatility } from '../predictions/utils-api';
import { intelUuidForSlug, isUnderclassmenClassYear } from '../../lib/underclassmen-intel';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { ALLOWLIST_2027, ALLOWLIST_2028, CANONICAL_TARGET_NAMES } = require('../../lib/recruiting-target-allowlist');
const { filterBlockedRecruits, isBlockedRecruit } = require('../../lib/recruiting-blocked-players');
const { loadTargetBoardBySlug } = require('../../lib/target-board-path');
const { isFloridaSchool, isActiveUfTarget, isCommittedElsewhere } = require('../../lib/recruiting-target-filters');
const { resolveCommitmentOverride } = require('../../lib/commitment-prediction-override');
const { resolveUfProbability, resolveGatorVaultLikelihood, pickRivalsPmScore, loadUfPctPredictorsBySlug } = require('../../lib/uf-probability-utils');

const RECRUITING_PLAYERS_PATH = path.join(__dirname, '../../data/recruiting/players.json');
const EARLY_WATCHLIST_PATH = path.join(__dirname, '../../data/futurecast/early-watchlist.json');

function targetBoardPath(classYear: number): string {
  return path.join(__dirname, `../../data/recruiting/${classYear}-target-board.json`);
}
const RIVALS_PREDICTIONS_PATH = path.join(__dirname, '../../data/war-room/rivals-predictions.json');
const MOVEMENT_WINDOW_DAYS = 7;
export const UNDERCLASSMEN_MOVEMENT_WINDOW_DAYS = 30;

function seedCommittedTo(seed: Record<string, unknown>): string | null {
  const raw = seed.committedTo ?? seed.committed_to ?? null;
  return raw != null ? String(raw) : null;
}

function loadRivalsCompetingSchools(): Map<string, { name: string; pct: number }[]> {
  try {
    const doc = JSON.parse(fs.readFileSync(RIVALS_PREDICTIONS_PATH, 'utf8')) as {
      predictions?: Array<{ playerSlug?: string; predictionSchool?: string; confidence?: number }>;
    };
    const bySlug = new Map<string, Map<string, number>>();
    for (const row of doc.predictions ?? []) {
      const slug = String(row.playerSlug || '').toLowerCase();
      const school = String(row.predictionSchool || '').trim();
      if (!slug || !school) continue;
      const schools = bySlug.get(slug) ?? new Map<string, number>();
      schools.set(school, Math.max(schools.get(school) ?? 0, Number(row.confidence) || 0));
      bySlug.set(slug, schools);
    }
    const out = new Map<string, { name: string; pct: number }[]>();
    for (const [slug, schools] of bySlug) {
      const entries = [...schools.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const total = entries.reduce((sum, [, score]) => sum + score, 0) || 1;
      out.set(
        slug,
        entries
          .filter(([name]) => !isFloridaSchool(name))
          .map(([name, score]) => ({ name, pct: Math.round((score / total) * 100) }))
      );
    }
    return out;
  } catch {
    return new Map();
  }
}

function rivalsPredictors(
  slug: string,
  schools: { name: string; pct: number }[]
): Array<{ name: string; score: number }> {
  return schools.map((s) => ({ name: s.name, score: s.pct }));
}

export type FutureCastPriority = 'high' | 'medium' | 'low';

export interface FutureCastBoardPlayer {
  id: string;
  slug: string;
  name: string;
  classYear: number;
  position: string;
  school?: string | null;
  hometown?: string | null;
  state?: string | null;
  composite: number;
  stars: number;
  natlRank?: number | null;
  posRank?: number | null;
  stateRank?: number | null;
  /** UF % (Likelihood) — GatorVault multi-signal commit likelihood. Null when unknown. */
  ufConfidence: number | null;
  ufProbabilitySource?: string;
  ufProbabilityLabel?: string | null;
  ufProbabilityLowConfidence?: boolean;
  /** Confirmed On3 UF RPM % — market signal, not the Lab primary forecast. */
  ufRpmPct?: number | null;
  /** Fit % (Scheme Match) — scheme, roster, and athletic fit. Null when unknown. */
  fitScore: number | null;
  /** Rolling UF probability delta for movementWindowDays. Null when unknown. */
  trendDelta7d: number | null;
  volatility7d: number;
  /** Priority tier tag; numeric Priority Score is on high-priority API. */
  priority: FutureCastPriority;
  committedTo?: string | null;
  predictors?: Array<{ name: string; score: number }>;
  competingSchools?: Array<{ name: string; pct: number }>;
  ufPredictionSuppressed?: boolean;
  commitmentStatus?: string | null;
}

export interface MovementHeatmapData {
  upCount: number;
  downCount: number;
  flatCount: number;
  windowDays: number;
}

export type LoadBoardOptions = {
  /** Movement window for Δ% (default 7 for 2027 board, 30 for underclassmen). */
  movementWindowDays?: number;
};

function toPercent(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  const n = Number(value);
  return n <= 1 ? Math.round(n * 1000) / 10 : Math.round(n * 10) / 10;
}

function toPercentOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return toPercent(value);
}

function resolvePriority(ufConfidence: number | null, fitScore: number | null): FutureCastPriority {
  const uf = ufConfidence ?? 0;
  const fit = fitScore ?? 0;
  const score = uf * 0.6 + fit * 0.4;
  if (score >= 55 || uf >= 60) return 'high';
  if (score >= 35 || uf >= 40) return 'medium';
  return 'low';
}

function firstPositiveStorePct(...values: Array<number | null | undefined>): number | undefined {
  for (const value of values) {
    if (value == null || !Number.isFinite(Number(value))) continue;
    if (Number(value) > 0) return Number(value);
  }
  return undefined;
}

function resolveBoardFitScore(input: {
  override: boolean;
  classYear: number;
  slug: string;
  model: { ufFitScore?: number | null; confidence?: number | null; ufProbability?: number | null } | undefined;
  seed: Record<string, unknown>;
  recruiting: Record<string, unknown> | null;
  rank: { stars?: number | null; nationalRank?: number | null } | undefined;
}): number | null {
  if (input.override) return null;

  let candidate: number | null = null;
  const modelFit = input.model?.ufFitScore;
  if (modelFit != null && Number.isFinite(Number(modelFit))) {
    candidate = Math.round(Number(modelFit));
  }

  if (candidate == null) {
    for (const raw of [
      input.seed.fitScore,
      input.recruiting?.fitScore,
      input.recruiting?.ufFitScore,
    ]) {
      if (raw != null && Number.isFinite(Number(raw)) && Number(raw) > 0) {
        candidate = Math.round(Number(raw));
        break;
      }
    }
  }

  if (candidate == null && isUnderclassmenClassYear(input.classYear)) {
    try {
      const { buildUfFitSeedProfile } = require('../../lib/uf-fit-score-seed');
      const profile = buildUfFitSeedProfile({
        playerId: intelUuidForSlug(input.slug),
        slug: input.slug,
        classYear: input.classYear,
        state: String(input.recruiting?.state ?? input.seed.state ?? ''),
        targetSeed: input.seed,
        recruiting: input.recruiting,
        modelPred: input.model ?? null,
      });
      const score = profile?.uf_fit_score;
      if (score != null && Number.isFinite(Number(score))) {
        candidate = Math.round(Number(score));
      }
    } catch {
      candidate = null;
    }
  }

  // Airtight Fit: Sumrall-staff scheme match requires War Room / film evidence.
  // No evidence → null (do not show rating-forged Fit %).
  try {
    const { resolveEvidenceBackedFitScore } = require('../../lib/scheme-fit-evidence');
    const pos = String(
      input.recruiting?.pos ??
        input.recruiting?.position ??
        input.seed.pos ??
        input.seed.position ??
        ''
    );
    const resolved = resolveEvidenceBackedFitScore(
      { slug: input.slug, pos, position: pos, fitScore: candidate },
      { existingFit: candidate }
    );
    return resolved.fitScore;
  } catch {
    if (isUnderclassmenClassYear(input.classYear)) return null;
    return candidate;
  }
}

async function loadRecruitingPlayer(slug: string): Promise<Record<string, unknown> | null> {
  try {
    const store = require('../../lib/recruiting-store');
    const player = await store.getPlayerBySlug(slug);
    return player || null;
  } catch {
    return null;
  }
}

/** One Supabase round-trip (chunked) instead of N getPlayerBySlug calls. */
async function loadRecruitingPlayersBySlug(
  slugs: string[]
): Promise<Map<string, Record<string, unknown>>> {
  try {
    const store = require('../../lib/recruiting-store');
    if (typeof store.getPlayersBySlugs === 'function') {
      return await store.getPlayersBySlugs(slugs);
    }
  } catch (err) {
    console.warn(
      '[allowlist-board] batch recruiting lookup failed:',
      err instanceof Error ? err.message : err
    );
  }
  const map = new Map<string, Record<string, unknown>>();
  await Promise.all(
    slugs.map(async (slug) => {
      const player = await loadRecruitingPlayer(slug);
      if (player) map.set(slug, player);
    })
  );
  return map;
}

/** Shared board rows — single-flight so master/trending/home/movement do not stampede. */
const BOARD_PLAYERS_TTL_MS =
  parseInt(process.env.FUTURECAST_BOARD_PLAYERS_TTL_MS || String(90_000), 10) || 90_000;
let allowlistedBoardPlayersCache: { expires: number; value: FutureCastBoardPlayer[] } | null = null;
let allowlistedBoardPlayersInflight: Promise<FutureCastBoardPlayer[]> | null = null;

function resolveCompetingSchools(
  rivals: { name: string; pct: number }[] | undefined
): { name: string; pct: number }[] {
  return (rivals ?? [])
    .filter((s) => s?.name && !isFloridaSchool(s.name))
    .sort((a, b) => Number(b.pct) - Number(a.pct));
}

function loadEarlyWatchlistMeta(): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  try {
    const doc = JSON.parse(fs.readFileSync(EARLY_WATCHLIST_PATH, 'utf8')) as {
      entries?: Array<Record<string, unknown>>;
    };
    for (const entry of doc.entries ?? []) {
      const slug = String(entry.slug || '').toLowerCase();
      if (slug) map.set(slug, entry);
    }
  } catch {
    /* optional */
  }
  return map;
}

function loadSeedMeta(classYear = FUTURECAST_CLASS_YEAR): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  try {
    const board = JSON.parse(fs.readFileSync(targetBoardPath(classYear), 'utf8')) as {
      targets?: Array<Record<string, unknown>>;
    };
    for (const t of board.targets ?? []) {
      const slug = String(t.slug || '').toLowerCase();
      if (slug) map.set(slug, t);
    }
  } catch {
    /* optional */
  }
  try {
    const players = JSON.parse(fs.readFileSync(RECRUITING_PLAYERS_PATH, 'utf8')) as Array<
      Record<string, unknown>
    >;
    for (const p of players) {
      if (Number(p.classYear) !== classYear) continue;
      const slug = String(p.slug || '').toLowerCase();
      if (!slug) continue;
      const existing = map.get(slug) || {};
      const merged: Record<string, unknown> = { ...existing, ...p };
      if (
        (p.ufProbability == null || Number(p.ufProbability) <= 0) &&
        existing.ufProbability != null &&
        Number(existing.ufProbability) > 0
      ) {
        merged.ufProbability = existing.ufProbability;
      }
      if (
        (p.fitScore == null || Number(p.fitScore) <= 0) &&
        existing.fitScore != null &&
        Number(existing.fitScore) > 0
      ) {
        merged.fitScore = existing.fitScore;
      }
      map.set(slug, merged);
    }
  } catch {
    /* optional */
  }
  return map;
}

function buildHeatmap(players: FutureCastBoardPlayer[], windowDays = MOVEMENT_WINDOW_DAYS): MovementHeatmapData {
  let upCount = 0;
  let downCount = 0;
  let flatCount = 0;
  for (const p of players) {
    const delta = p.trendDelta7d;
    if (delta == null) {
      flatCount += 1;
      continue;
    }
    if (delta > 0) upCount += 1;
    else if (delta < 0) downCount += 1;
    else flatCount += 1;
  }
  return { upCount, downCount, flatCount, windowDays };
}

/** Static allow-list slug set — prefer getLiveTargetSlugSet() at runtime. */
export function getAllowlistSlugSet(): Set<string> {
  return new Set(
    filterBlockedRecruits(ALLOWLIST_2027.map((slug: string) => ({ slug }))).map((p) =>
      String(p.slug).toLowerCase()
    )
  );
}

/** Runtime live-board slug set for a class year (excludes UF commits). */
export async function getLiveBoardTargetSlugSet(classYear = FUTURECAST_CLASS_YEAR): Promise<Set<string>> {
  const { getLiveTargetSlugSet } = require('../../lib/live-board-targets');
  return getLiveTargetSlugSet(classYear);
}

export function buildHeatmapResponse(players: FutureCastBoardPlayer[]) {
  const heatmap = buildHeatmap(players);
  return {
    buckets: [
      { label: 'Up', count: heatmap.upCount },
      { label: 'Down', count: heatmap.downCount },
      { label: 'Flat', count: heatmap.flatCount },
    ],
    windowDays: heatmap.windowDays,
    movementHeatmap: {
      upCount: heatmap.upCount,
      downCount: heatmap.downCount,
      flatCount: heatmap.flatCount,
    },
  };
}

export async function buildAllowlistHeatmapPayload() {
  const players = await loadAllowlistedBoardPlayers();
  return buildHeatmapResponse(players);
}

/** Closing Class Lab members — open hunt + Flip Watch (commits stay on purpose). */
function isCuratedLabSlug(slug: string, classYear: number): boolean {
  const key = String(slug || '').toLowerCase();
  if (!key) return false;
  if (classYear === FUTURECAST_CLASS_YEAR) {
    return (ALLOWLIST_2027 as string[]).some((s) => String(s).toLowerCase() === key);
  }
  if (classYear === 2028) {
    return (ALLOWLIST_2028 as string[]).some((s) => String(s).toLowerCase() === key);
  }
  return false;
}

async function resolveBoardSlugs(classYear: number): Promise<string[]> {
  const { getLiveBoardTargets } = require('../../lib/live-board-targets');
  const liveTargets = await getLiveBoardTargets(classYear);
  const live = liveTargets
    .map((t: { slug?: string }) => String(t.slug || '').toLowerCase())
    .filter(Boolean);

  // 2027 Closing Class: never collapse Lab to only open isActiveUfTarget rows.
  // Flip Watch commits are intentional board members for trending / master / movement.
  if (classYear === FUTURECAST_CLASS_YEAR) {
    const curated = (ALLOWLIST_2027 as string[]).map((s) => String(s).toLowerCase());
    return [...new Set([...curated, ...live])];
  }
  return [...new Set(live)];
}

/** Build enriched FutureCast player rows for explicit slugs and class year. */
export async function loadBoardPlayersForSlugs(
  classYear: number,
  slugs: string[],
  options: LoadBoardOptions = {}
): Promise<FutureCastBoardPlayer[]> {
  const movementWindowDays = options.movementWindowDays ?? MOVEMENT_WINDOW_DAYS;
  const allowedSlugs = [...new Set(slugs.map((s) => String(s).toLowerCase()).filter(Boolean))];
  const allowedSet = new Set(allowedSlugs);
  const { buildAllowlistSlugAliasLookup } = require('../../lib/allowlist-slug-aliases');
  const aliasLookup = buildAllowlistSlugAliasLookup(allowedSlugs, classYear);
  const resolveCanonical = (rowSlug: string) =>
    aliasLookup.get(String(rowSlug || '').toLowerCase());
  const rankings = loadRecruitingRankings();
  const seedMeta = loadSeedMeta(classYear);
  const earlyWatchMeta = loadEarlyWatchlistMeta();
  const rivalsSchools = loadRivalsCompetingSchools();
  const predictorsBySlug = loadUfPctPredictorsBySlug();

  const [stockRowsRaw, predictionRows] = await Promise.all([
    listStockBoardRows(movementWindowDays, {
      lifecycle: 'HS',
      class_year: classYear,
    }).catch((err) => {
      console.warn('[allowlist-board] stock board unavailable:', err instanceof Error ? err.message : err);
      return [];
    }),
    listPredictions({
      class_year: classYear,
      status: 'ACTIVE',
      lifecycle: 'HS',
      limit: 500,
    }).catch((err) => {
      console.warn('[allowlist-board] predictions unavailable:', err instanceof Error ? err.message : err);
      return [];
    }),
  ]);

  const stockRows = filterMovementIntelStockRows(stockRowsRaw).filter((row) =>
    Boolean(resolveCanonical(String(row.slug || '').toLowerCase()))
  );
  const stockBySlug = new Map<string, (typeof stockRows)[0]>();
  for (const row of stockRows) {
    const canonical = resolveCanonical(String(row.slug || '').toLowerCase());
    if (canonical && allowedSet.has(canonical) && !stockBySlug.has(canonical)) {
      stockBySlug.set(canonical, row);
    }
  }

  const modelRows = dedupeFeedRows(filterModelPredictionsOnly(predictionRows)).filter((row) =>
    Boolean(resolveCanonical(String(row.slug || row.playerSlug || '').toLowerCase()))
  );
  const serialized = await serializeFeedRowsWithVolatility(modelRows);
  const predictionBySlug = new Map<string, (typeof serialized)[0]>();
  for (const row of serialized) {
    const canonical = resolveCanonical(String(row.playerSlug || '').toLowerCase());
    if (canonical && allowedSet.has(canonical) && !predictionBySlug.has(canonical)) {
      predictionBySlug.set(canonical, row);
    }
  }

  const playerIds = serialized.map((p) => p.playerId).filter(Boolean);
  const [historyMap, recruitingBySlug] = await Promise.all([
    listMovementHistoryByPlayerIds(playerIds, movementWindowDays),
    loadRecruitingPlayersBySlug(allowedSlugs),
  ]);

  const players: FutureCastBoardPlayer[] = [];

  for (const slug of allowedSlugs) {
    if (isBlockedRecruit({ slug })) continue;

    const seed = { ...(earlyWatchMeta.get(slug) ?? {}), ...(seedMeta.get(slug) ?? {}) };
    const recruiting = recruitingBySlug.get(slug) ?? null;
    const override = resolveCommitmentOverride(
      recruiting
        ? { ...recruiting, slug }
        : {
            slug,
            committedTo: seedCommittedTo(seed),
            insiderNotes: seed.insiderNotes,
            staffNotes: seed.staffNotes,
          }
    );
    const onCuratedLab = isCuratedLabSlug(slug, classYear);
    // Curated Flip Watch / Closing Class rows stay on Lab even when committed elsewhere.
    if (recruiting && !isActiveUfTarget(recruiting) && !override && !onCuratedLab) continue;
    if (
      !recruiting &&
      seedCommittedTo(seed) &&
      isCommittedElsewhere({ committedTo: seedCommittedTo(seed) }) &&
      !override &&
      !onCuratedLab
    ) {
      continue;
    }
    const rank = rankings.get(slug);
    const stock = stockBySlug.get(slug);
    const model = predictionBySlug.get(slug);

    const resolvedClassYear = Number(
      recruiting?.classYear ?? seed.classYear ?? classYear
    );
    const name =
      String(recruiting?.name || seed.name || CANONICAL_TARGET_NAMES[slug] || slug).trim() ||
      CANONICAL_TARGET_NAMES[slug] ||
      slug;

    const trendRaw =
      stock?.window_delta != null
        ? Number(stock.window_delta)
        : model?.delta != null
          ? Number(model.delta)
          : null;
    const trendDelta7d =
      trendRaw != null && Number.isFinite(trendRaw)
        ? Math.round(trendRaw * 1000) / 1000
        : null;
    const history = model?.playerId ? historyMap.get(model.playerId) ?? [] : [];
    const volatility7d =
      history.length > 0
        ? Math.round(calculateVolatility(history) * 100) / 100
        : trendDelta7d != null
          ? Math.round(Math.abs(trendDelta7d) * 100) / 100
          : 0;

    const committedTo =
      override?.committedTo ??
      (recruiting?.committedTo as string | null) ??
      seedCommittedTo(seed) ??
      model?.committedTo ??
      null;
    const ufCommitted = isFloridaSchool(committedTo);
    const ufPredictors: Array<{ name: string; score: number }> = [];
    if (model?.predictorId) {
      ufPredictors.push({
        name: String(model.predictorId),
        score: Math.round(Number(model.confidence) || 0),
      });
    }
    for (const ext of predictorsBySlug.get(slug) || []) {
      ufPredictors.push(ext);
    }
    const {
      sanitizeRpmPct,
      sanitizeStoreOddsPct,
    } = require('../../lib/uf-probability-utils') as {
      sanitizeRpmPct: (v: unknown) => number | null;
      sanitizeStoreOddsPct: (v: unknown, opts?: { rpmPct?: number | null }) => number | null;
    };
    let rpmPct =
      sanitizeRpmPct(recruiting?.ufRpmPct) ??
      sanitizeRpmPct(firstPositiveStorePct(recruiting?.ufRpmPct as number | undefined));
    if (rpmPct == null) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { loadOn3RpmUfPctBySlug } = require('../../lib/on3-rpm-allowlist') as {
          loadOn3RpmUfPctBySlug: () => Map<string, number>;
        };
        rpmPct = sanitizeRpmPct(loadOn3RpmUfPctBySlug().get(slug));
      } catch {
        /* optional */
      }
    }
    // Persisted residual poison (0.99→99/100) still lives on some Render store rows
    // (Trace Hawkins / Cyion Smith). Uncommitted kids cannot sit at 95%+ UF RPM.
    if (rpmPct != null && rpmPct >= 95 && !ufCommitted) {
      rpmPct = null;
    }
    let storePct =
      sanitizeStoreOddsPct(seed.ufProbability, { rpmPct }) ??
      sanitizeStoreOddsPct(recruiting?.ufProbability, { rpmPct }) ??
      sanitizeStoreOddsPct(recruiting?.futurecastProbability, { rpmPct }) ??
      undefined;
    if (storePct != null && storePct >= 95 && !ufCommitted) {
      storePct = undefined;
    }
    const fitScore = resolveBoardFitScore({
      override: Boolean(override),
      classYear: resolvedClassYear,
      slug,
      model,
      seed,
      recruiting,
      rank,
    });
    const rivalsPct = pickRivalsPmScore(ufPredictors);
    const underclassmen = isUnderclassmenClassYear(resolvedClassYear);
    const seedModel = String(model?.predictorId || '').toLowerCase() === 'allowlist_seed';
    const movementAbs = Math.abs(Number(trendDelta7d) || 0);
    const seedFlatDelta =
      seedModel && (movementAbs === 4 || Math.abs(Math.round(movementAbs * 100)) === 4);
    const movementFraction = seedFlatDelta
      ? 0
      : movementAbs <= 1
        ? Number(trendDelta7d) || 0
        : (Number(trendDelta7d) || 0) / 100;
    const resolvedUf = override
      ? null
      : underclassmen
        ? resolveGatorVaultLikelihood({
            // Do not let allowlist_seed placeholder confidence drive GV likelihood.
            modelPct: seedModel ? 0 : model?.confidence ?? model?.ufProbability,
            rpmPct,
            rivalsPct,
            fitScore: fitScore ?? 0,
            storePct,
            delta7d: movementFraction,
            stars: Number(rank?.stars ?? recruiting?.stars ?? seed.stars ?? 0) || null,
            headliner: Boolean(seed.headliner),
          })
        : resolveUfProbability({
            modelPct: model?.confidence ?? model?.ufProbability,
            storePct: firstPositiveStorePct(rpmPct, storePct),
            predictors: ufPredictors,
            stars: Number(rank?.stars ?? recruiting?.stars ?? seed.stars ?? 0) || null,
            headliner: Boolean(seed.headliner),
          });
    let ufConfidence = override
      ? null
      : resolvedUf && (resolvedUf.value > 0 || resolvedUf.lowConfidence)
        ? resolvedUf.value
        : null;
    if (ufCommitted) ufConfidence = 100;

    const rivalsCompete = override ? [] : resolveCompetingSchools(rivalsSchools.get(slug));
    let recruitingCompete: { name: string; pct: number }[] = [];
    if (!override && recruiting) {
      try {
        const { competingSchoolsFromRecruitingRecord } = require('../../lib/underclassmen-intel');
        recruitingCompete = competingSchoolsFromRecruitingRecord(recruiting);
      } catch {
        for (const c of (recruiting.competitors as Array<{ school?: string; name?: string; score?: number; pct?: number }> | undefined) || []) {
          const name = String(c?.school || c?.name || '').trim();
          const pct = Number(c?.score ?? c?.pct);
          if (!name || !Number.isFinite(pct) || pct <= 0 || isFloridaSchool(name)) continue;
          recruitingCompete.push({ name, pct: Math.round(pct) });
        }
      }
    }
    const competingSchools = recruitingCompete.length ? recruitingCompete : rivalsCompete;
    // Keep predictor list as prediction sources — drop allowlist_seed placeholders.
    const predictors = override
      ? []
      : (ufPredictors.length ? ufPredictors : rivalsPredictors(slug, rivalsCompete)).filter(
          (x) => !/allowlist[_\s-]?seed/i.test(String(x?.name || ''))
        );
    const trendDelta7dResolved = override
      ? 0
      : trendDelta7d;
    const volatility7dResolved = override ? 0 : volatility7d;

    const position = (() => {
      const key = String(slug).toLowerCase();
      if (resolvedClassYear === 2028 && ALLOWLIST_2028.includes(key)) {
        const boardRow = loadTargetBoardBySlug(2028).get(key);
        if (boardRow) {
          const { getAllowlistDiscoveryFields } = require('../../lib/early-discovery-allowlist-merge');
          const discoveryFields = getAllowlistDiscoveryFields(key, 2028);
          if (discoveryFields?.position) return String(discoveryFields.position).trim().toUpperCase();
        }
      }
      const editorial = require('../../lib/recruiting-editorial-positions');
      return editorial.resolveFutureCastPosition({
        slug,
        classYear: resolvedClassYear,
        recruiting,
        seed,
        rank,
        model,
      });
    })();

    players.push({
      id: model?.playerId ?? (isUnderclassmenClassYear(resolvedClassYear) ? intelUuidForSlug(slug) : slug),
      slug,
      name,
      classYear: resolvedClassYear,
      position: position || 'TBD',
      school: (recruiting?.school as string) ?? (seed.school as string) ?? model?.school ?? null,
      hometown: (recruiting?.hometown as string) ?? (seed.hometown as string) ?? null,
      state: (recruiting?.state as string) ?? (seed.state as string) ?? rank?.state ?? null,
      composite: Math.round((rank?.compositeScore ?? Number(recruiting?.rating ?? seed.rating ?? 0)) * 100) / 100,
      stars: Number(rank?.stars ?? recruiting?.stars ?? seed.stars ?? 0) || 0,
      natlRank: rank?.nationalRank ?? (recruiting?.natlRank as number) ?? (seed.natlRank as number) ?? null,
      posRank: rank?.positionRank ?? (recruiting?.posRank as number) ?? (seed.posRank as number) ?? null,
      stateRank: rank?.stateRank ?? (recruiting?.stateRank as number) ?? (seed.stateRank as number) ?? null,
      ufConfidence,
      ufProbabilitySource: resolvedUf?.source,
      ufProbabilityLabel: resolvedUf?.label ?? null,
      ufProbabilityLowConfidence: Boolean(resolvedUf?.lowConfidence),
      ufRpmPct: rpmPct ?? null,
      fitScore,
      trendDelta7d: trendDelta7dResolved,
      volatility7d: volatility7dResolved,
      priority: override ? 'low' : resolvePriority(ufConfidence, fitScore),
      committedTo,
      predictors,
      competingSchools,
      ufPredictionSuppressed: Boolean(override),
      commitmentStatus: override?.commitmentStatus ?? null,
    });
  }

  const withTrend = enrichBoardPlayersWithUfTrendMovement(players);
  return withTrend.sort((a, b) => (b.ufConfidence ?? -1) - (a.ufConfidence ?? -1));
}

/**
 * Lab movement: fill null / seed±4 deltas from durable daily UF% snapshots.
 * Records today's GV confidence so history keeps growing between cron runs.
 */
function enrichBoardPlayersWithUfTrendMovement(
  players: FutureCastBoardPlayer[]
): FutureCastBoardPlayer[] {
  if (!players.length) return players;
  try {
    const ufTrend = require('../../lib/uf-trend-snapshot');
    ufTrend.recordGvSnapshots(
      players.map((p) => ({
        slug: p.slug,
        ufConfidence: p.ufConfidence,
        ufProbability: p.ufConfidence,
        ufPct: p.ufConfidence,
        ufRpmPct: p.ufRpmPct,
      }))
    );
    // Prefer gatorvault-sourced points, but fall back to legacy unsourced history
    // (pre-source snapshots) so Lab movement is not blank after durable migrate.
    const deltaMap = ufTrend.buildDelta7dBySlug(
      players.map((p) => p.slug),
      new Date(),
      { preferSource: 'gatorvault', requireSource: false }
    ) as Map<string, number>;

    return players.map((p) => {
      const key = String(p.slug || '').toLowerCase();
      const snapRaw = deltaMap.get(key);
      const snapDelta =
        snapRaw != null && Number.isFinite(snapRaw) && Math.abs(snapRaw) >= 1
          ? Math.round(snapRaw)
          : null;
      const existing = p.trendDelta7d;
      const existingAbs = existing == null || !Number.isFinite(Number(existing)) ? null : Math.abs(Number(existing));
      // Legacy allowlist_seed used ±4 placeholders — only replace those when a real
      // snapshot delta exists. Do not blank genuine stock moves of exactly ±4.
      const seedFlat = existingAbs === 4;

      let trendDelta7d = existing;
      if (seedFlat && snapDelta != null) trendDelta7d = snapDelta;
      else if (existing == null) trendDelta7d = snapDelta;

      const { canExposeWeekDelta } = require('../../lib/uf-probability-utils') as {
        canExposeWeekDelta: (opts: Record<string, unknown>) => boolean;
      };
      if (
        trendDelta7d != null &&
        !canExposeWeekDelta({
          delta: trendDelta7d,
          rpmPct: p.ufRpmPct,
          lowConfidence: p.ufProbabilityLowConfidence,
        })
      ) {
        trendDelta7d = null;
      }

      const volatility7d =
        trendDelta7d == null
          ? 0
          : p.volatility7d > 0
            ? p.volatility7d
            : Math.round(Math.abs(Number(trendDelta7d)) * 100) / 100;

      return { ...p, trendDelta7d, volatility7d };
    });
  } catch (err) {
    console.warn(
      '[allowlist-board] uf-trend enrich failed:',
      err instanceof Error ? err.message : err
    );
    return players;
  }
}

export async function loadAllowlistedBoardPlayers(): Promise<FutureCastBoardPlayer[]> {
  const now = Date.now();
  if (allowlistedBoardPlayersCache && allowlistedBoardPlayersCache.expires > now) {
    return allowlistedBoardPlayersCache.value;
  }
  if (allowlistedBoardPlayersInflight) return allowlistedBoardPlayersInflight;

  allowlistedBoardPlayersInflight = (async () => {
    const slugs = await resolveBoardSlugs(FUTURECAST_CLASS_YEAR);
    const players = await loadBoardPlayersForSlugs(FUTURECAST_CLASS_YEAR, slugs);
    allowlistedBoardPlayersCache = {
      expires: Date.now() + BOARD_PLAYERS_TTL_MS,
      value: players,
    };
    return players;
  })().finally(() => {
    allowlistedBoardPlayersInflight = null;
  });

  return allowlistedBoardPlayersInflight;
}

export async function buildMasterBoardPayload() {
  const players = await loadAllowlistedBoardPlayers();
  const activePredictions = players.filter((p) => !p.ufPredictionSuppressed);
  const heatmap = buildHeatmap(activePredictions);

  const trendingUp = [...activePredictions]
    .filter((p) => (p.trendDelta7d ?? 0) > 0)
    .sort((a, b) => (b.trendDelta7d ?? 0) - (a.trendDelta7d ?? 0));

  const trendingDown = [...activePredictions]
    .filter((p) => (p.trendDelta7d ?? 0) < 0)
    .sort((a, b) => (a.trendDelta7d ?? 0) - (b.trendDelta7d ?? 0));

  const activeTargets = activePredictions.filter(isActiveUfTarget);

  const highVolatility = [...activeTargets]
    .filter((p) => p.volatility7d >= 0.15)
    .sort((a, b) => b.volatility7d - a.volatility7d);

  const highPriority = [...activePredictions]
    .filter((p) => p.priority === 'high' && isActiveUfTarget(p))
    .sort((a, b) => (b.ufConfidence ?? 0) - (a.ufConfidence ?? 0));

  const commitWatch = [...activeTargets]
    .filter((p) => (p.ufConfidence ?? 0) >= 50 && (p.trendDelta7d ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.ufConfidence ?? 0) +
        (b.trendDelta7d ?? 0) -
        ((a.ufConfidence ?? 0) + (a.trendDelta7d ?? 0))
    )
    .slice(0, 3)
    .map((p) => ({
      playerId: p.id,
      slug: p.slug,
      name: p.name,
      ufConfidence: p.ufConfidence ?? 0,
      recentMovement: p.trendDelta7d ?? 0,
    }));

  const ufConfidenceAverage =
    activePredictions.length > 0
      ? Math.round(
          (activePredictions.reduce((sum, p) => sum + (p.ufConfidence ?? 0), 0) /
            activePredictions.length) *
            10
        ) / 10
      : 0;

  const confidenceSparkline = activePredictions.slice(0, 12).map((p) => p.ufConfidence ?? 0);

  return {
    classYear: FUTURECAST_CLASS_YEAR,
    updatedAt: new Date().toISOString(),
    movementHeatmap: {
      upCount: heatmap.upCount,
      downCount: heatmap.downCount,
      flatCount: heatmap.flatCount,
    },
    heatmap: {
      buckets: [
        { label: 'Up', count: heatmap.upCount },
        { label: 'Down', count: heatmap.downCount },
        { label: 'Flat', count: heatmap.flatCount },
      ],
      windowDays: heatmap.windowDays,
    },
    ufConfidenceAverage,
    confidenceSparkline,
    commitWatch,
    highPriority: {
      playerIds: highPriority.map((p) => p.id),
      players: highPriority.slice(0, 18),
    },
    movementSummary: {
      risers: trendingUp.slice(0, 8).map((p) => p.id),
      fallers: trendingDown.slice(0, 8).map((p) => p.id),
      highVolatility: highVolatility.slice(0, 8).map((p) => p.id),
      riserPlayers: trendingUp.slice(0, 8),
      fallerPlayers: trendingDown.slice(0, 8),
      volatilePlayers: highVolatility.slice(0, 8),
    },
    players,
  };
}

export async function buildTrendingBoardPayload() {
  const players = (await loadAllowlistedBoardPlayers()).filter((p) => !p.ufPredictionSuppressed);
  let trendingUp = players
    .filter((p) => (p.trendDelta7d ?? 0) > 0)
    .sort((a, b) => (b.trendDelta7d ?? 0) - (a.trendDelta7d ?? 0));
  let trendingDown = players
    .filter((p) => (p.trendDelta7d ?? 0) < 0)
    .sort((a, b) => (a.trendDelta7d ?? 0) - (b.trendDelta7d ?? 0));

  // When the Closing Class hunt list is flat, still surface real 7d stock movers
  // so Lab Trending is not blank while flip/open targets sit at Δ0.
  if (!trendingUp.length && !trendingDown.length) {
    try {
      const stockRows = filterTrendingStockRows(
        await listStockBoardRows(MOVEMENT_WINDOW_DAYS, {
          lifecycle: 'HS',
          class_year: FUTURECAST_CLASS_YEAR,
        })
      );
      const moverSlugs = [
        ...new Set(
          stockRows
            .filter((row) => Math.abs(Number(row.window_delta) || 0) >= 1)
            .map((row) => String(row.slug || '').toLowerCase())
            .filter(Boolean)
        ),
      ];
      if (moverSlugs.length) {
        const extras = (await loadBoardPlayersForSlugs(FUTURECAST_CLASS_YEAR, moverSlugs)).filter(
          (p) => !p.ufPredictionSuppressed
        );
        trendingUp = extras
          .filter((p) => (p.trendDelta7d ?? 0) > 0)
          .sort((a, b) => (b.trendDelta7d ?? 0) - (a.trendDelta7d ?? 0));
        trendingDown = extras
          .filter((p) => (p.trendDelta7d ?? 0) < 0)
          .sort((a, b) => (a.trendDelta7d ?? 0) - (b.trendDelta7d ?? 0));
      }
    } catch (err) {
      console.warn(
        '[allowlist-board] trending stock fallback failed:',
        err instanceof Error ? err.message : err
      );
    }
  }

  return {
    classYear: FUTURECAST_CLASS_YEAR,
    updatedAt: new Date().toISOString(),
    trendingUp,
    trendingDown,
  };
}

/** Discovery-class (2028+) movement board — live targets only, never UF commits. */
const discoveryBoardCache = new Map<number, { expires: number; value: FutureCastBoardPlayer[] }>();
const discoveryBoardInflight = new Map<number, Promise<FutureCastBoardPlayer[]>>();

async function loadDiscoveryMovementPlayers(classYear: number): Promise<FutureCastBoardPlayer[]> {
  const now = Date.now();
  const cached = discoveryBoardCache.get(classYear);
  if (cached && cached.expires > now) return cached.value;
  const inflight = discoveryBoardInflight.get(classYear);
  if (inflight) return inflight;

  const pending = (async () => {
    const { getLiveBoardTargets } = require('../../lib/live-board-targets') as {
      getLiveBoardTargets: (year: number) => Promise<Array<{ slug?: string }>>;
    };
    const { ALLOWLIST_2028 } = require('../../lib/recruiting-target-allowlist') as {
      ALLOWLIST_2028: string[];
    };

    const live = await getLiveBoardTargets(classYear);
    const liveSlugs = live
      .map((t) => String(t.slug || '').toLowerCase())
      .filter(Boolean);
    const liveSet = new Set(liveSlugs);
    const allowlistFirst =
      classYear === 2028
        ? (ALLOWLIST_2028 as string[])
            .map((s) => String(s).toLowerCase())
            .filter((slug) => liveSet.has(slug))
        : [];
    const extras = liveSlugs.filter((slug) => !allowlistFirst.includes(slug));
    const slugs = [...allowlistFirst, ...extras];
    const players = slugs.length ? await loadBoardPlayersForSlugs(classYear, slugs) : [];
    discoveryBoardCache.set(classYear, {
      expires: Date.now() + BOARD_PLAYERS_TTL_MS,
      value: players,
    });
    return players;
  })().finally(() => {
    discoveryBoardInflight.delete(classYear);
  });

  discoveryBoardInflight.set(classYear, pending);
  return pending;
}

export async function buildMovementIntelPayload(classYear = FUTURECAST_CLASS_YEAR) {
  const year = Number(classYear);
  const resolvedYear =
    Number.isFinite(year) && year >= 2027 && year <= 2030 ? year : FUTURECAST_CLASS_YEAR;

  const players =
    resolvedYear >= 2028
      ? await loadDiscoveryMovementPlayers(resolvedYear)
      : await loadAllowlistedBoardPlayers();
  const { canExposeWeekDelta } = require('../../lib/uf-probability-utils') as {
    canExposeWeekDelta: (opts: Record<string, unknown>) => boolean;
  };
  const activeTargets = players
    .filter((p) => isActiveUfTarget(p) && !p.ufPredictionSuppressed)
    .map((p) => {
      if (
        p.trendDelta7d != null &&
        !canExposeWeekDelta({
          delta: p.trendDelta7d,
          rpmPct: p.ufRpmPct,
          lowConfidence: p.ufProbabilityLowConfidence,
        })
      ) {
        return { ...p, trendDelta7d: null, volatility7d: 0 };
      }
      return p;
    });
  const heatmap = buildHeatmap(activeTargets);

  const risers = activeTargets
    .filter((p) => (p.trendDelta7d ?? 0) > 0)
    .sort((a, b) => (b.trendDelta7d ?? 0) - (a.trendDelta7d ?? 0));
  const fallers = activeTargets
    .filter((p) => (p.trendDelta7d ?? 0) < 0)
    .sort((a, b) => (a.trendDelta7d ?? 0) - (b.trendDelta7d ?? 0));
  const highVolatility = [...activeTargets]
    .filter((p) => p.volatility7d >= 0.15)
    .sort((a, b) => b.volatility7d - a.volatility7d);
  const stable = activeTargets
    .filter((p) => p.volatility7d < 0.1 && Math.abs(p.trendDelta7d ?? 0) < 0.05)
    .sort((a, b) => (b.ufConfidence ?? 0) - (a.ufConfidence ?? 0));
  const fitScoreLeaders = [...activeTargets].sort(
    (a, b) => (b.fitScore ?? -1) - (a.fitScore ?? -1)
  );
  const fitScoreRisks = [...activeTargets].sort(
    (a, b) => (a.fitScore ?? 999) - (b.fitScore ?? 999)
  );

  let alerts: { id: string; message: string; createdAt: string }[] = [];
  try {
    const { listAlerts } = await import('../../models/alerts');
    const raw = await listAlerts(8, resolvedYear);
    const allowedSet = await getLiveBoardTargetSlugSet(resolvedYear);
    alerts = raw
      .filter((a) => !a.playerSlug || allowedSet.has(String(a.playerSlug).toLowerCase()))
      .map((a) => ({
        id: a.id,
        message: a.message || a.title || 'Movement alert',
        createdAt: a.createdAt || new Date().toISOString(),
      }));
  } catch {
    /* optional */
  }

  return {
    classYear: resolvedYear,
    updatedAt: new Date().toISOString(),
    movementHeatmap: {
      upCount: heatmap.upCount,
      downCount: heatmap.downCount,
      flatCount: heatmap.flatCount,
    },
    heatmap: {
      buckets: [
        { label: 'Up', count: heatmap.upCount },
        { label: 'Down', count: heatmap.downCount },
        { label: 'Flat', count: heatmap.flatCount },
      ],
      windowDays: heatmap.windowDays,
    },
    risers,
    fallers,
    highVolatility,
    stable,
    fitScoreLeaders,
    fitScoreRisks,
    alerts,
  };
}

export async function findAllowlistedPlayer(idOrSlug: string): Promise<FutureCastBoardPlayer | null> {
  const key = String(idOrSlug || '').toLowerCase();
  const players = await loadAllowlistedBoardPlayers();
  return players.find((p) => p.id === idOrSlug || p.slug === key) ?? null;
}
