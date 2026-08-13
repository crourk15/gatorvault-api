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

/** Strip live odds before writing so stamps never bake stale RPM / fake market Δ. */
function stripLiveRpmFields(profile) {
  if (!profile || typeof profile !== 'object') return profile;
  const doc = { ...profile };
  if (doc.player && typeof doc.player === 'object') {
    const player = { ...doc.player };
    delete player.ufRpmPct;
    // Keep committed 100s in stamp for Florida commits; live overlay re-asserts.
    doc.player = player;
  }
  if (doc.futurecastSummary && typeof doc.futurecastSummary === 'object') {
    const summary = { ...doc.futurecastSummary };
    // Keep labeled gvProbability / fit. Never bake On3 or unlabeled uf% / synthetic Δ.
    delete summary.on3UfProbability;
    delete summary.ufProbability;
    delete summary.movementDelta;
    doc.futurecastSummary = summary;
  }
  // Synthetic 7d curves must not ship as market movement on prepared-meal stamps.
  doc.movementWindow = null;
  doc.movementHistory = [];
  if (Array.isArray(doc.competingSchools)) {
    doc.competingSchools = doc.competingSchools.filter(
      (c) => String(c?.source || '').toLowerCase() !== 'legacy'
    );
  }
  doc.stampMeta = {
    ...(doc.stampMeta && typeof doc.stampMeta === 'object' ? doc.stampMeta : {}),
    rpmStripped: true,
    marketFakesStripped: true,
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

/**
 * Cheap live garnish — On3/RPM (+ locked commits). Dossier body stays stamped.
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
      // Never expose synthetic GV week-delta as market movement.
      movementDelta: null,
      fitScore: futurecastSummary?.fitScore ?? player.ufFitScore ?? 100,
      volatilityScore: futurecastSummary?.volatilityScore ?? 0,
    };
  } else if (rpm != null) {
    const marketRivals = Array.isArray(profile.competingSchools)
      ? profile.competingSchools.filter((s) => String(s?.source || '').toLowerCase() !== 'legacy')
      : [];
    const rivalMax = Math.max(0, ...marketRivals.map((s) => Number(s?.pct) || 0));
    futurecastSummary = {
      ...(futurecastSummary || {
        predictedSchool: null,
        fitScore: player.ufFitScore ?? null,
        volatilityScore: null,
      }),
      on3UfProbability: rpm,
      // Unlabeled ufProbability = live On3 only (never GV model score).
      ufProbability: rpm,
      gvProbability: futurecastSummary?.gvProbability ?? null,
      movementDelta: null,
      // Heal stale stamps that crowned a legacy rival over live UF RPM.
      ...(rpm >= rivalMax ? { predictedSchool: 'Florida' } : {}),
    };
  } else if (futurecastSummary) {
    // No live On3 — do not leave GV copied into unlabeled ufProbability.
    delete futurecastSummary.ufProbability;
    delete futurecastSummary.on3UfProbability;
    futurecastSummary.movementDelta = null;
  }

  // Drop legacy phantom peers from the board field fans see.
  let competingSchools = Array.isArray(profile.competingSchools)
    ? profile.competingSchools.filter((s) => String(s?.source || '').toLowerCase() !== 'legacy')
    : profile.competingSchools;

  // Keep FutureCast Picks Florida row on the live On3 market % (not stale GV stamp score).
  let portalPredictions = profile.portalPredictions;
  const floridaPct = ufCommit ? 100 : rpm;
  if (
    floridaPct != null &&
    portalPredictions &&
    typeof portalPredictions === 'object' &&
    Array.isArray(portalPredictions.predictions)
  ) {
    const predictions = portalPredictions.predictions.map((row) => {
      if (!row || typeof row !== 'object') return row;
      const school = String(row.school || '');
      if (!/\bflorida\b|\bgators\b|\buf\b/i.test(school)) return row;
      return {
        ...row,
        score: floridaPct,
        sourceType: row.sourceType || 'BLENDED',
        predictorId: ufCommit ? row.predictorId || 'gatorvault' : 'on3-rpm',
      };
    });
    portalPredictions = { ...portalPredictions, predictions };
  }

  return {
    ...profile,
    player,
    futurecastSummary,
    competingSchools,
    portalPredictions,
    movementWindow: null,
    movementHistory: [],
    lastUpdated: new Date().toISOString(),
    servedFrom: 'stamp',
    rpmLive: true,
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
