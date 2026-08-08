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
      movementDelta: futurecastSummary?.movementDelta ?? null,
      fitScore: futurecastSummary?.fitScore ?? player.ufFitScore ?? 100,
      volatilityScore: futurecastSummary?.volatilityScore ?? 0,
    };
  } else if (rpm != null) {
    futurecastSummary = {
      ...(futurecastSummary || {
        predictedSchool: null,
        movementDelta: null,
        fitScore: player.ufFitScore ?? null,
        volatilityScore: null,
      }),
      on3UfProbability: rpm,
      // On3 panel prefers RPM; keep GV from stamp when present.
      ufProbability: rpm,
      gvProbability: futurecastSummary?.gvProbability ?? null,
    };
  }

  return {
    ...profile,
    player,
    futurecastSummary,
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

async function getStampedFullProfile(slug) {
  const key = String(slug || '')
    .trim()
    .toLowerCase();
  if (!key) return null;
  const stamp = readStamp(key);
  if (!stamp) return null;
  const recruiting = await loadLiveRecruiting(key);
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
  overlayLiveRpm,
  getStampedFullProfile,
  listAllowlistStampSlugs,
  listRosterStampSlugs,
  listPreparedMealSlugs,
  stampExists,
  getStampCoverage,
  inferProfileKind,
};
