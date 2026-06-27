/**
 * UF Fit seed batch — target board + MODEL predictions → uf_specific_profiles.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { getPlayerById, listPlayers } from '../../../models/player';
import { upsertUFSpecificProfile } from '../../../models/uf-specific-profile';

const require = createRequire(import.meta.url);
const { buildUfFitSeedProfile } = require('../../../lib/uf-fit-score-seed.js');
const { loadFuturecastPredictionBySlug } = require('../../../lib/load-futurecast-prediction-by-slug.js');

const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TARGET_BOARD_PATH = path.join(serverRoot, 'data/recruiting/2027-target-board.json');
const RECRUITING_PLAYERS_PATH = path.join(serverRoot, 'data/recruiting/players.json');

export interface UfFitSeedBatchOptions {
  classYear?: number;
  dryRun?: boolean;
  limit?: number;
  playerId?: string;
}

export interface UfFitSeedBatchResult {
  ok: boolean;
  dryRun: boolean;
  classYear: number;
  candidates: number;
  upserted: number;
  skipped: number;
  ufFitScore?: number;
  samples: Array<{ slug: string; uf_fit_score: number | null; uf_status: string | null }>;
}

function loadTargetBoardBySlug(): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  try {
    const doc = JSON.parse(fs.readFileSync(TARGET_BOARD_PATH, 'utf8')) as {
      targets?: Array<{ slug?: string }>;
    };
    for (const row of doc.targets || []) {
      if (row?.slug) map.set(String(row.slug).toLowerCase(), row as Record<string, unknown>);
    }
  } catch {
    /* optional */
  }
  return map;
}

function loadRecruitingBySlug(): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  try {
    const rows = JSON.parse(fs.readFileSync(RECRUITING_PLAYERS_PATH, 'utf8')) as Array<{ slug?: string }>;
    for (const row of rows || []) {
      if (row?.slug) map.set(String(row.slug).toLowerCase(), row as Record<string, unknown>);
    }
  } catch {
    /* optional */
  }
  return map;
}

async function seedOnePlayer(
  player: { id: string; slug: string; class_year: number; state: string | null },
  maps: {
    targetBySlug: Map<string, Record<string, unknown>>;
    recruitingBySlug: Map<string, Record<string, unknown>>;
    predictionBySlug: Map<string, unknown>;
  },
  dryRun: boolean
): Promise<{ upserted: boolean; skipped: boolean; profile: ReturnType<typeof buildUfFitSeedProfile> | null }> {
  const slugKey = String(player.slug || '').toLowerCase();
  const targetSeed = maps.targetBySlug.get(slugKey) || null;
  const recruiting = maps.recruitingBySlug.get(slugKey) || null;
  const modelPred =
    maps.predictionBySlug.get(player.slug) || maps.predictionBySlug.get(slugKey) || null;

  if (!targetSeed && !recruiting && !modelPred) {
    return { upserted: false, skipped: true, profile: null };
  }

  const profile = buildUfFitSeedProfile({
    playerId: player.id,
    slug: player.slug,
    classYear: player.class_year,
    state: player.state,
    targetSeed,
    recruiting,
    modelPred,
  });

  if (!dryRun) {
    await upsertUFSpecificProfile(profile);
  }

  return { upserted: true, skipped: false, profile };
}

export async function runUfFitSeedBatch(
  opts: UfFitSeedBatchOptions = {}
): Promise<UfFitSeedBatchResult> {
  const classYear = opts.classYear ?? 2027;
  const dryRun = opts.dryRun ?? false;
  const targetBySlug = loadTargetBoardBySlug();
  const recruitingBySlug = loadRecruitingBySlug();
  const predictionBySlug = await loadFuturecastPredictionBySlug(classYear);

  const maps = { targetBySlug, recruitingBySlug, predictionBySlug };
  const samples: UfFitSeedBatchResult['samples'] = [];
  let upserted = 0;
  let skipped = 0;
  let candidates = 0;
  let ufFitScore: number | undefined;

  if (opts.playerId) {
    const player = await getPlayerById(opts.playerId);
    if (!player) {
      return { ok: false, dryRun, classYear, candidates: 0, upserted: 0, skipped: 0, samples };
    }
    candidates = 1;
    const result = await seedOnePlayer(player, maps, dryRun);
    if (result.skipped) skipped = 1;
    if (result.upserted) {
      upserted = 1;
      ufFitScore = result.profile?.uf_fit_score ?? undefined;
      if (result.profile) {
        samples.push({
          slug: player.slug,
          uf_fit_score: result.profile.uf_fit_score,
          uf_status: result.profile.uf_status,
        });
      }
    }
    return { ok: true, dryRun, classYear, candidates, upserted, skipped, ufFitScore, samples };
  }

  let players = await listPlayers({ class_year: classYear, status: 'HS' });
  if (opts.limit != null && opts.limit > 0) {
    players = players.slice(0, opts.limit);
  }
  candidates = players.length;

  for (const player of players) {
    const result = await seedOnePlayer(player, maps, dryRun);
    if (result.skipped) {
      skipped += 1;
      continue;
    }
    upserted += 1;
    if (samples.length < 8 && result.profile) {
      samples.push({
        slug: player.slug,
        uf_fit_score: result.profile.uf_fit_score,
        uf_status: result.profile.uf_status,
      });
    }
  }

  return { ok: true, dryRun, classYear, candidates, upserted, skipped, samples };
}
