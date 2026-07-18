/**
 * Auto-promote verified Florida recruiting signals onto FutureCast Lab.
 *
 * Stages:
 *   watchlist — credible Florida involvement (prediction / multi-source / soft visit)
 *   lab       — offer OR verified OV OR (prediction + corroborating source)
 *
 * Never promotes bare beat mentions alone.
 */
'use strict';

const store = require('./recruiting-store');
const { isActiveUfTarget, isFloridaSchool } = require('./recruiting-target-filters');
const { isVerifiedRecruitingTarget } = require('./recruiting-target-verification');
const { canonicalTargetSlug, getAllowlistSet } = require('./recruiting-target-allowlist');
const labPromotions = require('./lab-promotions-store');

const CLASS_YEARS = [2027, 2028];
const MAX_LAB_PROMOTIONS_PER_RUN = 12;
const MAX_WATCH_PROMOTIONS_PER_RUN = 20;

function uniq(list) {
  return [...new Set((list || []).map(String).filter(Boolean))];
}

function floridaOfferOnPlayer(player) {
  // Explicit offer flags / offer rows only — do not treat OV status as an offer.
  if (player?.ufOfferVerified || player?.hasUFOffer || player?.ufOffer === true) return true;
  const offers = Array.isArray(player?.offers)
    ? player.offers
    : Array.isArray(player?.offerList)
      ? player.offerList
      : [];
  return offers.some((o) => isFloridaSchool(o?.school || o?.name || o));
}

function floridaVisitOnPlayer(player) {
  const ov = String(player?.ufOvStatus || player?.uf_ov_status || '').toLowerCase();
  if (ov && /cancel/.test(ov)) return false;
  // Soft player-field visit signal (watchlist-grade unless visit log verifies).
  if (ov && /\b(visit|scheduled|official|unofficial)\b/.test(ov)) return true;
  if (player?.visitStart || player?.visitEnd) return true;
  const visits = Array.isArray(player?.visits) ? player.visits : [];
  return visits.some((v) => {
    const school = v?.school || 'Florida';
    return isFloridaSchool(school);
  });
}

function loadFloridaOfferSlugs() {
  try {
    const { listOfferLogs } = require('./recruiting-offer-log-store');
    const items = typeof listOfferLogs === 'function' ? listOfferLogs({ limit: 500 }) : [];
    return new Set(
      (items || [])
        .filter((row) => isFloridaSchool(row.school || 'Florida'))
        .map((row) => canonicalTargetSlug(row.playerSlug))
        .filter(Boolean)
    );
  } catch {
    return new Set();
  }
}

function loadFloridaVisitSlugs() {
  try {
    const { listVisitLogs } = require('./recruiting-visit-log-store');
    const { isVerifiedVisitLogSource } = require('./visit-intel-utils');
    const items = typeof listVisitLogs === 'function' ? listVisitLogs({ limit: 500 }) : [];
    const out = new Set();
    for (const row of items || []) {
      if (!isFloridaSchool(row.school || 'Florida')) continue;
      const official = String(row.visitType || '').includes('official');
      if (official && !isVerifiedVisitLogSource(row.source, row)) continue;
      const slug = canonicalTargetSlug(row.playerSlug);
      if (slug) out.add(slug);
    }
    return out;
  } catch {
    return new Set();
  }
}

function loadRivalsPmFloridaSlugs() {
  const fs = require('fs');
  const path = require('path');
  const out = new Map(); // slug -> { confidence, name, classYear, source }

  function absorb(row) {
    const school = row.predictionSchool || row.school || row.predictedSchool || '';
    const conf = Number(row.confidence ?? row.ufProbability ?? row.pct);
    if (school && !isFloridaSchool(school)) return;
    if (!school && !(Number.isFinite(conf) && conf >= 20)) return;
    const slug = canonicalTargetSlug(row.playerSlug || row.slug);
    if (!slug) return;
    const prev = out.get(slug);
    if (prev && Number(prev.confidence || 0) >= Number(conf || 0)) return;
    out.set(slug, {
      confidence: Number.isFinite(conf) ? conf : null,
      name: row.playerName || row.name || row.fullName || slug,
      classYear: Number(row.classYear || row.class_year) || null,
      source: String(row.source || row.predictorId || 'rivals_pm'),
    });
  }

  const candidates = [
    '/var/data/recruiting/rivals-predictions.json',
    path.join(__dirname, '..', 'data', 'war-room', 'rivals-predictions.json'),
    path.join(__dirname, '..', 'data', 'recruiting', 'rivals-pm-snapshot.json'),
  ];
  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const rows = Array.isArray(raw?.predictions)
        ? raw.predictions
        : Array.isArray(raw)
          ? raw
          : [];
      rows.forEach(absorb);
    } catch {
      /* optional */
    }
  }

  return out;
}

function collectSignals(player, ctx) {
  const slug = canonicalTargetSlug(player.slug || player.name);
  const reasons = [];
  const sources = [];

  const offerLog = ctx.offerSlugs.has(slug);
  const visitLog = ctx.visitSlugs.has(slug);
  const playerOffer = floridaOfferOnPlayer(player);
  const playerVisit = floridaVisitOnPlayer(player);
  const rivals = ctx.rivalsBySlug.get(slug);

  if (offerLog || playerOffer) {
    reasons.push('florida_offer');
    sources.push(offerLog ? 'offer_log' : 'player_offer');
  }
  if (visitLog || playerVisit) {
    reasons.push('florida_visit');
    sources.push(visitLog ? 'visit_log' : 'player_visit');
  }
  if (rivals) {
    reasons.push('prediction_machine');
    sources.push(rivals.source || 'rivals_pm');
  }
  if (player.on3Id || player.on3ProfileUrl) sources.push('on3');
  if (player.rivalsId || player.rivalsLastPrediction) sources.push('rivals');
  if (player.ingressSource === 'staff-dashboard' || player.staffEntry) sources.push('staff');

  const sourceCount = uniq(sources).length;
  if (sourceCount >= 2 && reasons.length) reasons.push('multi_source');

  return {
    slug,
    reasons: uniq(reasons),
    sources: uniq(sources),
    sourceCount,
    hasOffer: reasons.includes('florida_offer'),
    hasVisit: reasons.includes('florida_visit'),
    visitVerified: visitLog === true,
    hasPrediction: reasons.includes('prediction_machine'),
    rivals,
  };
}

function decideStage(signals) {
  if (!signals.reasons.length) return null;
  // Lab: hard Florida involvement only
  if (signals.hasOffer) return 'lab';
  if (signals.hasVisit && signals.visitVerified) return 'lab';
  if (signals.hasVisit && signals.hasPrediction) return 'lab';
  if (signals.hasPrediction && signals.sourceCount >= 2) return 'lab';
  // Watchlist: softer but still Florida-linked
  if (signals.hasVisit || signals.hasPrediction) return 'watchlist';
  if (signals.reasons.includes('multi_source')) return 'watchlist';
  return null;
}

async function ensureTargetPlayer(player, stageRow) {
  const slug = stageRow.slug;
  const existing = (await store.getPlayerBySlug(slug).catch(() => null)) || player;
  const year = Number(stageRow.classYear || existing?.classYear || player?.classYear);
  const name = stageRow.name || existing?.name || player?.name || slug;
  const next = {
    ...(existing || {}),
    slug,
    name,
    classYear: year,
    category: 'target',
    status: existing?.status && existing.status !== 'recruit' ? existing.status : 'uncommitted',
    labPromotionStage: stageRow.stage,
    labPromotionReasons: stageRow.reasons,
    labPromotedAt: stageRow.promotedAt || new Date().toISOString(),
  };
  if (typeof store.upsertPlayer === 'function') {
    await store.upsertPlayer(next);
  } else if (typeof store.savePlayer === 'function') {
    await store.savePlayer(next);
  }
  return next;
}

async function sideEffectsForLab(player, stageRow) {
  try {
    const { addToAdminAllowlist } = require('./admin-allowlist-store');
    addToAdminAllowlist({
      slug: stageRow.slug,
      name: stageRow.name || player.name,
      classYear: stageRow.classYear,
    });
  } catch (err) {
    console.warn('[lab-intel-promote] admin-allowlist:', err.message);
  }

  if (Number(stageRow.classYear) === 2028) {
    try {
      const { upsert2028TargetBoardSeed } = require('./player-intel-entry');
      upsert2028TargetBoardSeed(player);
    } catch {
      /* optional */
    }
  }

  try {
    const { provisionAllowlistPredictionForSlug } = require('./allowlist-futurecast-provision');
    await provisionAllowlistPredictionForSlug(stageRow.slug, stageRow.classYear);
  } catch (err) {
    console.warn('[lab-intel-promote] fc provision:', err.message);
  }
}

/**
 * Scan recruiting store + offer/visit/prediction signals and promote.
 */
async function runLabIntelPromote(options = {}) {
  const dryRun = Boolean(options.dryRun);
  const offerSlugs = loadFloridaOfferSlugs();
  const visitSlugs = loadFloridaVisitSlugs();
  const rivalsBySlug = loadRivalsPmFloridaSlugs();
  const ctx = { offerSlugs, visitSlugs, rivalsBySlug };

  const players = await store.getAllPlayers();
  const candidates = [];

  for (const player of players || []) {
    const year = parseInt(player.classYear || player.class_year, 10);
    if (!CLASS_YEARS.includes(year)) continue;
    if (!isActiveUfTarget(player) && player.category === 'commit') continue;
    if (!isActiveUfTarget(player) && (player.committedTo || player.status === 'committed')) continue;

    // Prefer verified identity for Lab; watchlist can be slightly looser if prediction exists.
    const signals = collectSignals(player, ctx);
    const stage = decideStage(signals);
    if (!stage) continue;

    if (stage === 'lab' && !isVerifiedRecruitingTarget(player) && !signals.hasOffer && !signals.hasVisit) {
      // prediction+source without verified id → watchlist only
      signals._forceWatch = true;
    }

    const finalStage = signals._forceWatch ? 'watchlist' : stage;
    const slug = signals.slug;
    const alreadyLab = getAllowlistSet(year).has(slug) || labPromotions.getLabSlugSet(year).has(slug);
    const alreadyWatch = labPromotions.getWatchlistSlugSet(year).has(slug);
    if (finalStage === 'lab' && alreadyLab) continue;
    if (finalStage === 'watchlist' && (alreadyLab || alreadyWatch)) continue;
    // watchlist → lab upgrades are allowed when finalStage === 'lab' && alreadyWatch

    candidates.push({
      player,
      stage: finalStage,
      slug,
      name: player.name || rivalsBySlug.get(slug)?.name || slug,
      classYear: year,
      reasons: signals.reasons,
      sources: signals.sources,
    });
  }

  // Prefer Lab promotions, then watchlist; cap volume.
  const labCandidates = candidates
    .filter((c) => c.stage === 'lab')
    .slice(0, MAX_LAB_PROMOTIONS_PER_RUN);
  const watchCandidates = candidates
    .filter((c) => c.stage === 'watchlist')
    .slice(0, MAX_WATCH_PROMOTIONS_PER_RUN);

  const promoted = { lab: [], watchlist: [], skipped: 0 };
  for (const row of [...labCandidates, ...watchCandidates]) {
    if (dryRun) {
      promoted[row.stage].push({ slug: row.slug, name: row.name, reasons: row.reasons, dryRun: true });
      continue;
    }
    const saved = labPromotions.upsertStage(row.stage, row);
    if (!saved.ok) {
      promoted.skipped += 1;
      continue;
    }
    const player = await ensureTargetPlayer(row.player, saved.row);
    if (row.stage === 'lab') {
      await sideEffectsForLab(player, saved.row);
    }
    promoted[row.stage].push({
      slug: row.slug,
      name: row.name,
      classYear: row.classYear,
      reasons: row.reasons,
      sources: row.sources,
      created: saved.created,
    });
  }

  return {
    ok: true,
    dryRun,
    scanned: (players || []).length,
    candidates: candidates.length,
    promotedLab: promoted.lab.length,
    promotedWatchlist: promoted.watchlist.length,
    promoted,
    store: labPromotions.getStoreInfo(),
  };
}

function getLabPromotionStatus() {
  const doc = labPromotions.readDoc();
  return {
    ok: true,
    store: labPromotions.getStoreInfo(),
    lab: Object.values(doc.lab || {}),
    watchlist: Object.values(doc.watchlist || {}),
  };
}

module.exports = {
  runLabIntelPromote,
  getLabPromotionStatus,
  collectSignals,
  decideStage,
  floridaOfferOnPlayer,
  floridaVisitOnPlayer,
};
