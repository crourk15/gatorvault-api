/**
 * Resolve allowlist target UF % for daily trend snapshots (GatorVault likelihood).
 */
const fs = require('fs');
const path = require('path');
const {
  resolveUfProbability,
  resolveGatorVaultLikelihood,
  pickRivalsPmScore,
  loadUfPctPredictorsBySlug,
  loadOn3RpmPriorBySlug,
  toPercent,
} = require('./uf-probability-utils');

const BOARD_2027_PATH = path.join(__dirname, '..', 'data', 'recruiting', '2027-target-board.json');
const BOARD_2028_PATH = path.join(__dirname, '..', 'data', 'recruiting', '2028-target-board.json');

function loadTargetBoards() {
  const targets = [];
  for (const filePath of [BOARD_2027_PATH, BOARD_2028_PATH]) {
    try {
      const doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(doc.targets)) targets.push(...doc.targets);
    } catch {
      /* optional seed files */
    }
  }
  return targets;
}

function normalizeUuid(id) {
  if (!id || typeof id !== 'string') return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

function classYearOf(target, recruiting) {
  return Number(target.classYear ?? recruiting?.classYear ?? 0) || 0;
}

function resolveTargetUfPct(target, recruiting, predictorsBySlug) {
  const slug = String(target.slug || '').toLowerCase();
  const predictors = predictorsBySlug.get(slug) || [];
  const year = classYearOf(target, recruiting);
  const rpmPct = toPercent(recruiting?.ufRpmPct);
  const fitScore = toPercent(recruiting?.fitScore ?? target.fitScore);
  const storePct = toPercent(
    target.ufProbability ?? recruiting?.ufProbability ?? recruiting?.futurecastProbability
  );
  const rivalsPct = pickRivalsPmScore(predictors);

  if (year >= 2028) {
    const resolved = resolveGatorVaultLikelihood({
      modelPct: 0,
      rpmPct,
      rivalsPct,
      fitScore,
      storePct,
      delta7d: 0,
      stars: target.stars ?? recruiting?.stars ?? null,
      headliner: Boolean(target.headliner),
    });
    return resolved.value > 0
      ? { ufPct: resolved.value, rpmPct: rpmPct > 0 ? rpmPct : null, source: 'gatorvault' }
      : null;
  }

  const resolved = resolveUfProbability({
    modelPct: 0,
    storePct: storePct || rpmPct,
    predictors,
    stars: target.stars ?? recruiting?.stars ?? null,
    headliner: Boolean(target.headliner),
  });
  return resolved.value > 0
    ? { ufPct: resolved.value, rpmPct: rpmPct > 0 ? rpmPct : null, source: 'store' }
    : null;
}

function resolvePriorUfPct(slug, recruiting, futurecastRow, on3PriorBySlug) {
  const on3Prior = on3PriorBySlug?.get(String(slug || '').toLowerCase());
  if (on3Prior != null && Number.isFinite(Number(on3Prior))) {
    const n = Number(on3Prior);
    return n <= 1 ? Math.round(n * 100) : Math.round(n);
  }
  const prior = futurecastRow?.priorConfidence ?? recruiting?.priorConfidence ?? null;
  if (prior == null || !Number.isFinite(Number(prior))) return null;
  const n = Number(prior);
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

async function loadTargetSnapshots() {
  const { ALLOWLIST_2027, ALLOWLIST_2028 } = require('./recruiting-target-allowlist');
  const boardTargets = loadTargetBoards();
  const recruitingStore = require('./recruiting-store');
  const futurecastStore = require('./futurecast-store');
  const predictorsBySlug = loadUfPctPredictorsBySlug();
  const on3PriorBySlug = loadOn3RpmPriorBySlug();
  const rows = [];
  const seen = new Set();

  function pushTarget(target) {
    const slug = String(target.slug || '').toLowerCase();
    if (!slug || seen.has(slug)) return;
    const recruiting = recruitingStore.findBySlug(slug);
    const futurecastRow = futurecastStore.getByPlayerId(slug);
    const resolved = resolveTargetUfPct(target, recruiting, predictorsBySlug);
    if (!resolved) return;
    seen.add(slug);
    rows.push({
      slug,
      name: target.name || slug,
      ufPct: resolved.ufPct,
      rpmPct: resolved.rpmPct,
      source: resolved.source,
      playerId: normalizeUuid(recruiting?.id),
      priorUfPct: resolvePriorUfPct(slug, recruiting, futurecastRow, on3PriorBySlug),
    });
  }

  for (const target of boardTargets) pushTarget(target);

  for (const slugRaw of ALLOWLIST_2027) {
    pushTarget({ slug: slugRaw, classYear: 2027 });
  }
  for (const slugRaw of ALLOWLIST_2028) {
    pushTarget({ slug: slugRaw, classYear: 2028 });
  }

  return rows;
}

module.exports = {
  loadTargetBoards,
  loadTargetSnapshots,
  resolveTargetUfPct,
};
