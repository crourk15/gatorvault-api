/**
 * Prepared-meal player profiles — durable dossier stamps with live RPM overlay.
 *
 * Dossier (identity, War Room vault scouting, tape, ranks, competing schools, etc.)
 * is stamped ahead of time. On3/RPM odds stay live on every GET.
 *
 * Surfaces:
 * - 2027 commits / 2028 prospects → full-profile stamps
 * - Roster (team) → already prepared via server/data/roster/players.json (resolve path)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const requireFromHere = createRequire(__filename);
const { resolveRecruitingDataDir, BUNDLE_DIR } = require('./recruiting-data-dir');

const BUNDLE_STAMP_DIR = path.join(__dirname, '..', 'data', 'player-profiles', 'stamps');

function parseUfPct(raw) {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  const num = Number(raw);
  if (!(num > 0)) return null;
  return Math.min(100, Math.max(0, Math.round(num <= 1 ? num * 100 : num)));
}

function isFloridaSchool(value) {
  return /\bflorida\b|\bgators\b|\buf\b/i.test(String(value || ''));
}

function durableStampDir() {
  try {
    const base = resolveRecruitingDataDir();
    // Prefer sibling of recruiting data: /var/data/player-profiles/stamps
    if (path.resolve(base) !== path.resolve(BUNDLE_DIR)) {
      return path.join(path.dirname(base), 'player-profiles', 'stamps');
    }
  } catch {
    /* fall through */
  }
  return BUNDLE_STAMP_DIR;
}

function stampCandidates(slug) {
  const key = String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-');
  if (!key) return [];
  const name = `${key}.json`;
  return [path.join(durableStampDir(), name), path.join(BUNDLE_STAMP_DIR, name)];
}

/** Strip live odds before writing so stamps never bake stale RPM. */
function stripLiveRpmFields(profile) {
  if (!profile || typeof profile !== 'object') return profile;
  const doc = { ...profile };
  if (doc.player && typeof doc.player === 'object') {
    const player = { ...doc.player };
    delete player.ufRpmPct;
    // Fit is scheme match — never bake On3 UF% into ufFitScore.
    // If stamped Fit equals a probability-shaped field, drop it for live rebuild.
    const fit = Number(player.ufFitScore);
    const gf = Number(doc.futurecastSummary?.gvProbability);
    const uf = Number(doc.futurecastSummary?.ufProbability);
    if (
      Number.isFinite(fit) &&
      fit > 0 &&
      ((Number.isFinite(uf) && fit === Math.round(uf)) ||
        (Number.isFinite(gf) && fit === Math.round(gf)))
    ) {
      delete player.ufFitScore;
    }
    // Keep committed 100s in stamp for Florida commits; live overlay re-asserts.
    doc.player = player;
  }
  if (doc.futurecastSummary && typeof doc.futurecastSummary === 'object') {
    const summary = { ...doc.futurecastSummary };
    // Preserve gvProbability / fit / movement from dossier; clear On3 RPM slots.
    delete summary.on3UfProbability;
    // ufProbability on underclassmen is often the RPM display field — clear for live overlay.
    // Keep gvProbability when present.
    if (summary.gvProbability != null) {
      summary.ufProbability = summary.gvProbability;
    } else if (!isFloridaSchool(doc.player?.committedTo)) {
      delete summary.ufProbability;
    }
    doc.futurecastSummary = summary;
  }
  doc.stampMeta = {
    ...(doc.stampMeta && typeof doc.stampMeta === 'object' ? doc.stampMeta : {}),
    rpmStripped: true,
    stampedAt: new Date().toISOString(),
  };
  return doc;
}

function readStamp(slug) {
  for (const filePath of stampCandidates(slug)) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (doc && typeof doc === 'object' && doc.player) return doc;
    } catch {
      /* try next */
    }
  }
  return null;
}

function writeStamp(slug, profile, opts = {}) {
  const key = String(slug || '')
    .trim()
    .toLowerCase();
  if (!key || !profile || typeof profile !== 'object') return false;
  const cleaned = stripLiveRpmFields(profile);
  const profileKind = opts.profileKind || cleaned.stampMeta?.profileKind || inferProfileKind(cleaned);
  cleaned.stampMeta = {
    ...(cleaned.stampMeta || {}),
    slug: key,
    profileKind,
    stampedAt: new Date().toISOString(),
  };
  const targets = [path.join(durableStampDir(), `${key}.json`)];
  // Also write bundle when explicitly requested (seed generation / CI).
  if (opts.writeBundle) {
    targets.push(path.join(BUNDLE_STAMP_DIR, `${key}.json`));
  }
  let wrote = false;
  for (const filePath of targets) {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(cleaned), 'utf8');
      wrote = true;
    } catch (err) {
      console.warn('[profile-stamp] write failed', filePath, err.message);
    }
  }
  return wrote;
}

function inferProfileKind(profile) {
  const year = Number(profile?.player?.classYear || profile?.player?.class_year || 0);
  const committed = String(profile?.player?.committedTo || '');
  if (year === 2027 || (year > 0 && year <= 2027 && isFloridaSchool(committed))) {
    return 'commit-2027';
  }
  if (year >= 2028) return 'prospect-2028';
  if (String(profile?.source || '') === 'roster') return 'roster';
  return 'prospect';
}

function pickRankNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Heal ufFitScore so On3 UF% / RPM never displays as Scheme Fit.
 * Prefers recruiting.fitScore, then evidence-backed Fit, else keeps stamp Fit
 * only when it is not identical to live RPM.
 */
function resolveLiveUfFitScore(player, recruiting, rpm) {
  const storeFitRaw = Number(recruiting?.fitScore);
  const storeFit =
    Number.isFinite(storeFitRaw) && storeFitRaw > 0 && storeFitRaw <= 100
      ? Math.round(storeFitRaw)
      : null;
  // Never treat store Fit as valid when it is clearly the RPM number.
  const storeFitOk = storeFit != null && (rpm == null || storeFit !== rpm) ? storeFit : null;

  const stampedRaw = Number(player?.ufFitScore);
  const stamped =
    Number.isFinite(stampedRaw) && stampedRaw > 0 && stampedRaw <= 100
      ? Math.round(stampedRaw)
      : null;
  const stampedPoisoned = stamped != null && rpm != null && stamped === rpm;

  if (storeFitOk != null) return storeFitOk;

  if (!stampedPoisoned && stamped != null) return stamped;

  try {
    const { resolveEvidenceBackedFitScore } = require('./scheme-fit-evidence');
    const resolved = resolveEvidenceBackedFitScore({
      slug: player?.slug,
      pos: player?.position || player?.pos || recruiting?.pos || recruiting?.position,
      fitScore: storeFitOk,
      ufFitScore: storeFitOk,
    });
    if (resolved?.fitScore != null) return resolved.fitScore;
  } catch {
    /* optional */
  }
  return null;
}

/**
 * Cheap live garnish — On3 Industry ranks + RPM (+ locked commits).
 * Dossier narrative body stays stamped; rank/rating/odds refresh every GET.
 */
function overlayLiveRpm(profile, recruiting) {
  if (!profile || typeof profile !== 'object') return profile;
  const committedTo =
    recruiting?.committedTo ?? profile.player?.committedTo ?? profile.player?.committed_to ?? null;
  const ufCommit = isFloridaSchool(committedTo);
  const rpm = parseUfPct(recruiting?.ufRpmPct ?? recruiting?.ufProbability);

  const player = { ...(profile.player || {}) };
  if (rpm != null) player.ufRpmPct = rpm;
  if (committedTo) player.committedTo = committedTo;

  // Live On3 Industry Consensus — stamps bake ranks and go stale (Wright #208 vs #1).
  const natl = pickRankNumber(recruiting?.natlRank ?? recruiting?.nationalRank);
  const posRank = pickRankNumber(recruiting?.posRank ?? recruiting?.positionRank);
  const stateRank = pickRankNumber(recruiting?.stateRank);
  const rating = pickRankNumber(recruiting?.rating ?? recruiting?.displayRating ?? recruiting?.compositeRating);
  const stars = pickRankNumber(recruiting?.stars ?? recruiting?.consensusStars);
  if (natl != null) player.rankingNational = natl;
  if (posRank != null) player.rankingPosition = posRank;
  if (stateRank != null) player.rankingState = stateRank;
  if (rating != null) player.compositeRating = rating;
  if (stars != null && stars > 0) player.stars = stars;

  // Scheme Fit ≠ On3 UF%. Heal stamps that baked RPM into ufFitScore (e.g. Josiah Taylor 99).
  if (!ufCommit) {
    player.ufFitScore = resolveLiveUfFitScore(player, recruiting, rpm);
  } else if (player.ufFitScore == null || !(Number(player.ufFitScore) > 0)) {
    player.ufFitScore = 100;
  }

  let highSchoolProfile =
    profile.highSchoolProfile && typeof profile.highSchoolProfile === 'object'
      ? { ...profile.highSchoolProfile }
      : null;
  if (highSchoolProfile) {
    const stats = {
      ...(highSchoolProfile.stats && typeof highSchoolProfile.stats === 'object'
        ? highSchoolProfile.stats
        : {}),
    };
    if (natl != null) stats.natlRank = natl;
    if (posRank != null) stats.posRank = posRank;
    if (stateRank != null) stats.stateRank = stateRank;
    if (rating != null) stats.rating = rating;
    if (stars != null && stars > 0) stats.stars = stars;
    highSchoolProfile = { ...highSchoolProfile, stats };
  }

  let futurecastSummary =
    profile.futurecastSummary && typeof profile.futurecastSummary === 'object'
      ? { ...profile.futurecastSummary }
      : null;

  if (ufCommit) {
    futurecastSummary = {
      ...(futurecastSummary || {}),
      ufProbability: 100,
      on3UfProbability: 100,
      gvProbability: futurecastSummary?.gvProbability ?? 100,
      predictedSchool: 'Florida',
      movementDelta: futurecastSummary?.movementDelta ?? null,
      fitScore: futurecastSummary?.fitScore ?? player.ufFitScore ?? 100,
      volatilityScore: futurecastSummary?.volatilityScore ?? 0,
    };
  } else if (rpm != null) {
    const rivalMax = Math.max(
      0,
      ...(Array.isArray(profile.competingSchools)
        ? profile.competingSchools.map((s) => Number(s?.pct) || 0)
        : [])
    );
    const summaryFitRaw = Number(futurecastSummary?.fitScore);
    const summaryFitPoisoned =
      Number.isFinite(summaryFitRaw) && Math.round(summaryFitRaw) === rpm;
    futurecastSummary = {
      ...(futurecastSummary || {
        predictedSchool: null,
        movementDelta: null,
        volatilityScore: null,
      }),
      on3UfProbability: rpm,
      // On3 panel prefers RPM; keep GV from stamp when present.
      ufProbability: rpm,
      gvProbability: futurecastSummary?.gvProbability ?? null,
      // Scheme Fit from healed player — never mirror RPM.
      fitScore: summaryFitPoisoned ? player.ufFitScore : futurecastSummary?.fitScore ?? player.ufFitScore,
      // Heal stale stamps that crowned a legacy rival over live UF RPM.
      ...(rpm >= rivalMax ? { predictedSchool: 'Florida' } : {}),
    };
  }

  return {
    ...profile,
    player,
    ...(highSchoolProfile ? { highSchoolProfile } : {}),
    futurecastSummary,
    lastUpdated: new Date().toISOString(),
    servedFrom: 'stamp',
    rpmLive: true,
    ranksLive: natl != null || posRank != null || stateRank != null || rating != null,
  };
}

async function loadLiveRecruiting(slug) {
  try {
    // TS module — available when server boots with tsx / compiled path.
    const { getRecruitingPlayerBySlug } = requireFromHere('../api/players/recruiting-fallback');
    return await getRecruitingPlayerBySlug(slug);
  } catch {
    try {
      const store = require('./recruiting-player-store');
      if (typeof store.getBySlug === 'function') return store.getBySlug(slug);
      if (typeof store.getPlayerBySlug === 'function') return store.getPlayerBySlug(slug);
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Serve stamped dossier + live RPM. Returns null when no stamp. */

function isPearlVaultScouting(vault) {
  if (!vault || typeof vault !== 'object') return false;
  const evaluation = String(vault.evaluation || '').trim();
  const comparison = String(vault.comparison || '').trim();
  const projection = String(vault.projection || '').trim();
  const strengths = Array.isArray(vault.strengths)
    ? vault.strengths.map((s) => String(s || '').trim()).filter(Boolean)
    : [];
  return Boolean(evaluation && comparison && projection && strengths.length >= 3);
}

function resolveVaultScoutingForStamp(slug, stampVault) {
  try {
    const warRoom = require('./war-room-store');
    const { getVaultScoutingForSlug } = require('./recruiting-hub-elite');
    const key = String(slug || '').trim().toLowerCase();
    const bd = warRoom.getBreakdownBySlug(key);
    const quality = require('./recruiting-intel-quality');
    const provisional = !!bd && quality.isProvisionalVaultCard?.(bd);
    const live = getVaultScoutingForSlug(key);
    if (live) return live;
    // Hide provisional drafts even if an older stamp still has a pearl-shaped card.
    if (provisional) return null;
    // Film-desk clobber recovery: keep stamped Pearl when War Room was wiped.
    if (isPearlVaultScouting(stampVault)) return stampVault;
    return null;
  } catch {
    return isPearlVaultScouting(stampVault) ? stampVault : null;
  }
}

function stampPlayerPayload(stamp) {
  return stamp?.player && typeof stamp.player === 'object' ? stamp.player : null;
}

/** True when a prepared-meal stamp no longer matches the live/slug identity. */
function isPoisonedStamp(slug, stamp, recruiting = null) {
  const key = String(slug || '')
    .trim()
    .toLowerCase();
  if (!key || !stamp || typeof stamp !== 'object') return false;
  try {
    const { hasSlugNameFirstMismatch } = require('./recruit-identity-collision');
    const stamped = stampPlayerPayload(stamp) || {};
    const stampedName =
      stamped.fullName || stamped.name || stamped.playerName || '';
    if (
      hasSlugNameFirstMismatch({
        slug: key,
        name: stampedName,
        fullName: stampedName,
      })
    ) {
      return true;
    }
    if (recruiting && typeof recruiting === 'object') {
      const liveName = recruiting.name || recruiting.fullName || recruiting.playerName || '';
      const liveYear = Number(recruiting.classYear || recruiting.year || 0);
      const stampYear = Number(stamped.classYear || stamped.year || 0);
      if (
        liveName &&
        hasSlugNameFirstMismatch({
          slug: key,
          name: liveName,
          fullName: liveName,
        }) === false &&
        hasSlugNameFirstMismatch({
          slug: key,
          name: stampedName,
          fullName: stampedName,
        })
      ) {
        return true;
      }
      // Live recruit first-name disagrees with stamped first-name (Jamarcus vs Kamarion).
      if (liveName && stampedName) {
        const liveFirst = String(liveName).trim().split(/\s+/)[0].toLowerCase();
        const stampFirst = String(stampedName).trim().split(/\s+/)[0].toLowerCase();
        if (liveFirst && stampFirst && liveFirst !== stampFirst) return true;
      }
      if (liveYear > 0 && stampYear > 0 && liveYear !== stampYear) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function deleteStamp(slug) {
  const key = String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-');
  if (!key) return { deleted: 0, paths: [] };
  const paths = [];
  let deleted = 0;
  for (const filePath of stampCandidates(key)) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deleted += 1;
        paths.push(filePath);
      }
    } catch {
      /* ignore */
    }
  }
  return { deleted, paths };
}

async function getStampedFullProfile(slug) {
  const key = String(slug || '')
    .trim()
    .toLowerCase();
  if (!key) return null;
  const stamp = readStamp(key);
  if (!stamp) return null;
  const recruiting = await loadLiveRecruiting(key);
  if (isPoisonedStamp(key, stamp, recruiting)) {
    try {
      deleteStamp(key);
      console.warn('[profile-stamp] purged poisoned stamp', key, {
        stampedName: stamp?.player?.fullName || stamp?.player?.name || null,
        liveName: recruiting?.name || recruiting?.fullName || null,
      });
    } catch {
      /* ignore */
    }
    return null;
  }
  const out = overlayLiveRpm(stamp, recruiting);
  out.vaultScouting = resolveVaultScoutingForStamp(key, stamp.vaultScouting);
  return out;
}

function listAllowlistStampSlugs() {
  const { ALLOWLIST_2027, ALLOWLIST_2028 } = require('./recruiting-target-allowlist');
  const slugs = new Set();
  for (const s of ALLOWLIST_2027 || []) slugs.add(String(s).toLowerCase());
  for (const s of ALLOWLIST_2028 || []) slugs.add(String(s).toLowerCase());
  return [...slugs];
}

function listRosterStampSlugs() {
  try {
    const roster = require('./roster-store');
    return (roster.loadPlayers() || [])
      .map((p) => String(p.slug || '').toLowerCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Targets for prepared meals: 2027 commits + 2028 prospects (+ optional roster index). */
function listPreparedMealSlugs(opts = {}) {
  const includeRoster = opts.includeRoster === true;
  const slugs = new Set(listAllowlistStampSlugs());
  if (includeRoster) {
    for (const s of listRosterStampSlugs()) slugs.add(s);
  }
  return [...slugs];
}

function stampExists(slug) {
  return stampCandidates(slug).some((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
}

function getStampCoverage(opts = {}) {
  const slugs = listPreparedMealSlugs(opts);
  let present = 0;
  for (const slug of slugs) {
    if (stampExists(slug)) present += 1;
  }
  return {
    total: slugs.length,
    present,
    missing: slugs.length - present,
    coveragePct: slugs.length ? Math.round((present / slugs.length) * 1000) / 10 : 0,
  };
}

module.exports = {
  BUNDLE_STAMP_DIR,
  durableStampDir,
  parseUfPct,
  stripLiveRpmFields,
  readStamp,
  writeStamp,
  deleteStamp,
  isPoisonedStamp,
  overlayLiveRpm,
  getStampedFullProfile,
  listAllowlistStampSlugs,
  listRosterStampSlugs,
  listPreparedMealSlugs,
  stampExists,
  getStampCoverage,
  inferProfileKind,
};
