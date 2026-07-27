/**
 * Auto-promote verified Florida recruiting signals onto FutureCast Lab.
 *
 * Stages:
 *   watchlist — credible Florida involvement (Rivals PM / On3 RPM / multi-source / soft visit)
 *   lab       — offer OR verified OV OR (prediction/RPM + corroborating source)
 *
 * On3 RPM is first-class with Rivals PM (Pass 3 auto-radar).
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
  // Soft OV signal only — bare "visit" was polluted by beat ingest and is not proof.
  if (ov && /\b(scheduled|official|unofficial|completed)\b/.test(ov)) return true;
  if (player?.visitStart || player?.visitEnd) return true;
  const visits = Array.isArray(player?.visits) ? player.visits : [];
  return visits.some((v) => {
    const school = v?.school || 'Florida';
    return isFloridaSchool(school);
  });
}

/** Scan the full durable log — a 500-row window dropped older UF visits/offers off Lab promote. */
const FLORIDA_SIGNAL_LOG_LIMIT = 100000;

function loadFloridaOfferSlugs() {
  try {
    const { listOfferLogs } = require('./recruiting-offer-log-store');
    const items =
      typeof listOfferLogs === 'function' ? listOfferLogs({ limit: FLORIDA_SIGNAL_LOG_LIMIT }) : [];
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
    const items =
      typeof listVisitLogs === 'function' ? listVisitLogs({ limit: FLORIDA_SIGNAL_LOG_LIMIT }) : [];
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

/** On3 RPM UF % — allowlist sync store + any player.ufRpmPct already on the card. */
function loadOn3RpmFloridaSlugs(players = []) {
  const out = new Map(); // slug -> { confidence, name, classYear, source }
  try {
    const { loadOn3RpmUfPctBySlug, readDoc } = require('./on3-rpm-allowlist');
    const pctMap = loadOn3RpmUfPctBySlug();
    const doc = readDoc();
    const bySlug = new Map(
      (doc.entries || []).map((row) => [String(row.playerSlug || '').toLowerCase(), row])
    );
    for (const [slug, pct] of pctMap.entries()) {
      if (!slug || !(Number(pct) > 0)) continue;
      const row = bySlug.get(slug) || {};
      out.set(slug, {
        confidence: Number(pct),
        name: row.playerName || slug,
        classYear: Number(row.classYear) || null,
        source: 'on3_rpm',
      });
    }
  } catch {
    /* optional */
  }
  for (const player of players || []) {
    const slug = canonicalTargetSlug(player?.slug || player?.name);
    if (!slug) continue;
    const pct = Number(player.ufRpmPct ?? player.on3RpmPct);
    if (!(pct > 0)) continue;
    const prev = out.get(slug);
    if (prev && Number(prev.confidence || 0) >= pct) continue;
    out.set(slug, {
      confidence: pct,
      name: player.name || slug,
      classYear: Number(player.classYear) || null,
      source: 'on3_rpm_player',
    });
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
  const on3Rpm = ctx.on3RpmBySlug?.get(slug);
  const playerRpm = Number(player.ufRpmPct ?? player.on3RpmPct);
  const hasOn3Rpm =
    (on3Rpm && Number(on3Rpm.confidence) > 0) || (Number.isFinite(playerRpm) && playerRpm > 0);

  if (rivals || hasOn3Rpm) {
    reasons.push('prediction_machine');
    if (rivals) sources.push(rivals.source || 'rivals_pm');
    if (hasOn3Rpm) {
      reasons.push('on3_rpm');
      sources.push((on3Rpm && on3Rpm.source) || 'on3_rpm');
    }
  }
  if (player.on3Id || player.on3ProfileUrl) sources.push('on3');
  if (player.rivalsId || player.rivalsLastPrediction) sources.push('rivals');
  if (player.ingressSource === 'staff-dashboard' || player.staffEntry) sources.push('staff');

  const sourceCount = uniq(sources).length;
  if (sourceCount >= 2 && reasons.length) reasons.push('multi_source');

  const rpmConfidence = Number(
    (on3Rpm && on3Rpm.confidence) ||
      (Number.isFinite(playerRpm) && playerRpm > 0 ? playerRpm : 0) ||
      (rivals && rivals.confidence) ||
      0
  );

  return {
    slug,
    reasons: uniq(reasons),
    sources: uniq(sources),
    sourceCount,
    hasOffer: reasons.includes('florida_offer'),
    hasVisit: reasons.includes('florida_visit'),
    visitVerified: visitLog === true,
    hasPrediction: reasons.includes('prediction_machine'),
    hasOn3Rpm,
    rpmConfidence,
    rivals,
    on3Rpm: on3Rpm || (hasOn3Rpm ? { confidence: playerRpm, source: 'on3_rpm_player' } : null),
  };
}

function decideStage(signals) {
  if (!signals.reasons.length) return null;
  const strongRpm = Number(signals.rpmConfidence || 0) >= 40;
  // Lab: hard Florida involvement only
  if (signals.hasOffer) return 'lab';
  if (signals.hasVisit && signals.visitVerified) return 'lab';
  if (signals.hasVisit && signals.hasPrediction) return 'lab';
  if (signals.hasPrediction && signals.sourceCount >= 2) return 'lab';
  // Strong On3 RPM + any second Florida-linked source → Lab
  if (signals.hasOn3Rpm && strongRpm && signals.sourceCount >= 2) return 'lab';
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
  const players = await store.getAllPlayers();
  const on3RpmBySlug = loadOn3RpmFloridaSlugs(players);
  const ctx = { offerSlugs, visitSlugs, rivalsBySlug, on3RpmBySlug };
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


/**
 * Pass 3 — after a teaser RPM is named, put the prospect on radar immediately.
 * Lab if visit corroborates; otherwise watchlist + admin allowlist.
 */
async function promoteResolvedPredictionToRadar({
  slug,
  name,
  classYear = 2028,
  reasons = ['on3_rpm', 'teaser_identity'],
  sources = ['on3_rpm', 'teaser_identity'],
  ufRpmPct = null,
  dryRun = false,
  fetchRpm = true,
} = {}) {
  const key = canonicalTargetSlug(slug);
  if (!key) return { ok: false, error: 'slug_required' };
  const year = parseInt(classYear, 10) || 2028;
  const player = (await store.getPlayerBySlug(key).catch(() => null)) || {
    slug: key,
    name: name || key,
    classYear: year,
  };

  const visitSlugs = loadFloridaVisitSlugs();
  const hasVisit = visitSlugs.has(key) || floridaVisitOnPlayer(player);
  const stage = hasVisit ? 'lab' : 'watchlist';
  const row = {
    slug: key,
    name: name || player.name || key,
    classYear: year,
    reasons: uniq([...(reasons || []), hasVisit ? 'florida_visit' : null].filter(Boolean)),
    sources: uniq(sources || ['on3_rpm']),
    promotedAt: new Date().toISOString(),
    stage,
  };

  if (dryRun) return { ok: true, dryRun: true, stage, row };

  if (ufRpmPct != null && Number(ufRpmPct) > 0) {
    player.ufRpmPct = Math.round(Number(ufRpmPct));
  }

  const savedStage = labPromotions.upsertStage(stage, row);
  let savedPlayer = await ensureTargetPlayer(player, { ...row, stage });
  if (stage === 'lab') {
    await sideEffectsForLab(savedPlayer, { ...row, stage });
  } else {
    try {
      const { addToAdminAllowlist } = require('./admin-allowlist-store');
      addToAdminAllowlist({ slug: key, name: row.name, classYear: year });
    } catch (err) {
      console.warn('[lab-intel-promote] watchlist allowlist:', err.message);
    }
  }

  let rpmSync = null;
  if (fetchRpm && String(process.env.ON3_RPM_FETCH || 'true').toLowerCase() !== 'false') {
    try {
      rpmSync = await syncSingleSlugOn3Rpm(key, year);
      if (rpmSync?.ufPct != null) {
        savedPlayer = { ...savedPlayer, ufRpmPct: rpmSync.ufPct };
        if (typeof store.upsertPlayer === 'function') {
          await store.upsertPlayer(savedPlayer);
        }
      }
    } catch (err) {
      rpmSync = { ok: false, error: err.message };
    }
  }

  try {
    require('./ops-monitor').logEvent({
      subsystem: 'recruiting:auto-radar',
      status: 'promoted',
      message: `Auto-radar ${stage}: ${key}`,
      details: { slug: key, stage, reasons: row.reasons, rpmSync },
    });
  } catch {
    /* optional */
  }

  return {
    ok: true,
    stage,
    slug: key,
    created: savedStage.created,
    reasons: row.reasons,
    rpmSync,
  };
}

async function syncSingleSlugOn3Rpm(slug, classYear = 2028) {
  const on3 = require('./on3-recruit-client');
  const { buildOn3ProfileUrl } = require('./on3-urls');
  const rpm = require('./on3-rpm-allowlist');
  const recruitingStore = require('./recruiting-store');
  const key = String(slug || '').toLowerCase();
  let player = null;
  try {
    player = await recruitingStore.getPlayerBySlug(key);
  } catch {
    player = typeof recruitingStore.findBySlug === 'function' ? recruitingStore.findBySlug(key) : null;
  }
  const recruitSlug =
    (player && player.on3Slug) ||
    on3.resolveRecruitSlug(
      { slug: key, name: player?.name, on3Slug: player?.on3Slug, on3Id: player?.on3Id },
      new Map()
    );
  if (!recruitSlug) {
    return { ok: true, skipped: true, reason: 'no_recruit_slug', slug: key };
  }
  const profile = await on3.fetchRecruitProfile(recruitSlug);
  const ufPct = rpm.resolveUfPctFromProfile(profile, classYear);
  if (ufPct == null || ufPct <= 0) {
    return { ok: true, skipped: true, reason: (profile && profile.error) || 'no_uf_pct', slug: key };
  }
  const doc = rpm.readDoc();
  const entry = {
    playerSlug: key,
    playerName: (player && player.name) || key,
    classYear,
    ufPct,
    priorUfPct: null,
    profileUrl: buildOn3ProfileUrl(player || { slug: key, on3Slug: recruitSlug }),
    source: 'On3 RPM · UF',
    syncedAt: new Date().toISOString(),
  };
  const idx = (doc.entries || []).findIndex((row) => String(row.playerSlug || '').toLowerCase() === key);
  if (idx >= 0) doc.entries[idx] = Object.assign({}, doc.entries[idx], entry);
  else doc.entries.push(entry);
  rpm.writeDoc(doc);
  return { ok: true, slug: key, ufPct: ufPct, recruitSlug: recruitSlug };
}


module.exports = {
  runLabIntelPromote,
  getLabPromotionStatus,
  collectSignals,
  decideStage,
  floridaOfferOnPlayer,
  floridaVisitOnPlayer,
  loadFloridaOfferSlugs,
  loadFloridaVisitSlugs,
  FLORIDA_SIGNAL_LOG_LIMIT,
  loadOn3RpmFloridaSlugs,
  promoteResolvedPredictionToRadar,
  syncSingleSlugOn3Rpm,
};
