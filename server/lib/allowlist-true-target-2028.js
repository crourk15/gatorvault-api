/**
 * Formula-based 2028 true-target auto-include for FutureCast / Desk.
 *
 * Manual ALLOWLIST_2028 remains as a seed/override union. This module adds
 * prospects who clear locked thresholds so high-lead / elite chases cannot be
 * invisible due to a missing slug.
 *
 * Paths (Charles + Vault):
 * A) Florida lead >= 70% + Top-100 (or 4★ when national rank lags) — Mannings-style
 * B) Top-50 nationally + Florida leading the board — Jamarcus-style (~49% lead / #50)
 *    Never miss a Top-50 where UF is #1 just because lead is under 70%.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { isActiveUfTarget, isFloridaSchool } = require('./recruiting-target-filters');

const CLASS_YEAR = 2028;
/** Path A: minimum Florida lead % to auto-include with Top-100 quality. */
const LEAD_PCT_MIN = 70;
/** Path A: national rank ceiling when ranks are present. */
const NATL_RANK_MAX = 100;
/** Path B: elite national rank ceiling (Top-50). */
const ELITE_NATL_RANK_MAX = 50;
/**
 * Path B soft floor when we only have UF RPM (no full competitor ladder).
 * Prevents tiny leftover UF % from auto-including every Top-50.
 */
const ELITE_LEAD_SOFT_FLOOR = 25;

function slugKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function loadLocalPlayersSync() {
  try {
    const store = require('./recruiting-store');
    const file = path.join(store.DATA_DIR, 'players.json');
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function loadOn3RpmPctBySlug() {
  /** @type {Map<string, number>} */
  const out = new Map();
  try {
    const file = path.join(__dirname, '..', 'data', 'war-room', 'on3-rpm-allowlist.json');
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const row of raw.entries || []) {
      const slug = slugKey(row.playerSlug || row.slug);
      const pct = num(row.ufPct);
      if (!slug || pct == null || pct < 0) continue;
      out.set(slug, pct);
    }
  } catch {
    /* optional */
  }
  return out;
}

function floridaCompetitorLeadPct(player) {
  const comps = Array.isArray(player?.competitors) ? player.competitors : [];
  if (!comps.length) return null;
  let best = null;
  for (const row of comps) {
    const school = String(row?.school || '');
    if (!isFloridaSchool(school)) continue;
    const pct = num(row.pct ?? row.score);
    if (pct == null) continue;
    if (best == null || pct > best) best = pct;
  }
  if (best == null) return null;
  for (const row of comps) {
    const school = String(row?.school || '');
    if (isFloridaSchool(school)) continue;
    const pct = num(row.pct ?? row.score) || 0;
    if (pct > best) return null;
  }
  return best;
}

function rivalsFloridaLeadPct(player) {
  const conf = num(player?.rivalsConfidence);
  if (conf == null) return null;
  const pred = String(
    player?.rivalsLastPrediction || player?.rivalsPredictionSchool || player?.predictionSchool || ''
  ).trim();
  if (!pred) return conf >= LEAD_PCT_MIN ? conf : null;
  return isFloridaSchool(pred) ? conf : null;
}

function resolveFloridaLead(player, rpmBySlug = null) {
  const slug = slugKey(player?.slug || player?.id);
  const candidates = [];

  const ufRpm = num(player?.ufRpmPct);
  if (ufRpm != null) candidates.push({ pct: ufRpm, source: 'uf_rpm' });

  const rpmMap = rpmBySlug || loadOn3RpmPctBySlug();
  if (slug && rpmMap.has(slug)) {
    candidates.push({ pct: rpmMap.get(slug), source: 'on3_rpm_allowlist' });
  }

  const rival = rivalsFloridaLeadPct(player);
  if (rival != null) candidates.push({ pct: rival, source: 'rivals_pm' });

  const compLead = floridaCompetitorLeadPct(player);
  if (compLead != null) candidates.push({ pct: compLead, source: 'competitor_ladder' });

  if (!candidates.length) return { pct: null, source: null };
  candidates.sort((a, b) => b.pct - a.pct);
  return candidates[0];
}

function resolveNatlRank(player) {
  return num(player?.natlRank ?? player?.nationalRank ?? player?.ranking);
}

function resolveStars(player) {
  return Math.max(
    num(player?.stars) || 0,
    num(player?.consensusStars) || 0,
    num(player?.starsDisplay) || 0
  );
}

function passesBoardQuality(player) {
  const natl = resolveNatlRank(player);
  if (natl != null && natl > 0) return natl <= NATL_RANK_MAX;
  return resolveStars(player) >= 4;
}

function isEliteTop50(player) {
  const natl = resolveNatlRank(player);
  return natl != null && natl > 0 && natl <= ELITE_NATL_RANK_MAX;
}

/**
 * Florida is leading the chase (Path B).
 * Prefer competitor ladder (#1). Else accept UF RPM / Rivals PM with a soft floor.
 */
function floridaIsLeading(player, rpmBySlug = null) {
  const ladder = floridaCompetitorLeadPct(player);
  if (ladder != null) {
    return { ok: true, pct: ladder, source: 'competitor_ladder' };
  }

  const comps = Array.isArray(player?.competitors) ? player.competitors : [];
  if (comps.length) {
    // Ladder present but Florida not #1.
    return { ok: false, pct: null, source: 'competitor_ladder' };
  }

  const lead = resolveFloridaLead(player, rpmBySlug);
  if (lead.pct == null) return { ok: false, pct: null, source: null };

  if (lead.source === 'rivals_pm') {
    return { ok: true, pct: lead.pct, source: lead.source };
  }
  if (lead.source === 'uf_rpm' || lead.source === 'on3_rpm_allowlist') {
    if (lead.pct >= ELITE_LEAD_SOFT_FLOOR) {
      return { ok: true, pct: lead.pct, source: lead.source };
    }
    return { ok: false, pct: lead.pct, source: lead.source };
  }
  return { ok: false, pct: lead.pct, source: lead.source };
}

function passesLead(player, rpmBySlug = null) {
  const { pct, source } = resolveFloridaLead(player, rpmBySlug);
  if (pct == null || pct < LEAD_PCT_MIN) return { ok: false, pct, source };
  return { ok: true, pct, source };
}

function evaluateTrueTarget2028(player, opts = {}) {
  if (!player) return { ok: false, reason: 'missing_player' };
  const year = parseInt(player.classYear || player.class_year, 10);
  if (year !== CLASS_YEAR) return { ok: false, reason: 'wrong_class' };
  if (!isActiveUfTarget(player)) return { ok: false, reason: 'not_active_uf_target' };

  const natlRank = resolveNatlRank(player);
  const stars = resolveStars(player);

  // Path B — Top-50 + Florida leading (Jamarcus Johnson class).
  if (isEliteTop50(player)) {
    const leading = floridaIsLeading(player, opts.rpmBySlug);
    if (leading.ok) {
      return {
        ok: true,
        reason: 'formula_true_target_top50_uf_lead',
        path: 'top50_uf_lead',
        leadPct: leading.pct,
        leadSource: leading.source,
        natlRank,
        stars,
      };
    }
  }

  // Path A — Florida lead ≥70% + Top-100 / 4★ rank-lag (Mannings class).
  const lead = passesLead(player, opts.rpmBySlug);
  if (!lead.ok) {
    return {
      ok: false,
      reason: 'florida_lead_below_threshold',
      leadPct: lead.pct,
      leadSource: lead.source,
      natlRank,
      stars,
    };
  }
  if (!passesBoardQuality(player)) {
    return {
      ok: false,
      reason: 'board_quality_below_threshold',
      leadPct: lead.pct,
      leadSource: lead.source,
      natlRank,
      stars,
    };
  }
  return {
    ok: true,
    reason: 'formula_true_target',
    path: 'lead70_top100',
    leadPct: lead.pct,
    leadSource: lead.source,
    natlRank,
    stars,
  };
}

function listFormulaTrueTargetSlugs2028(opts = {}) {
  const rpmBySlug = opts.rpmBySlug || loadOn3RpmPctBySlug();
  const players = opts.players || loadLocalPlayersSync();
  const slugs = [];
  for (const player of players) {
    const result = evaluateTrueTarget2028(player, { rpmBySlug });
    if (!result.ok) continue;
    const slug = slugKey(player.slug || player.id);
    if (slug) slugs.push(slug);
  }
  return slugs;
}

module.exports = {
  CLASS_YEAR,
  LEAD_PCT_MIN,
  NATL_RANK_MAX,
  ELITE_NATL_RANK_MAX,
  ELITE_LEAD_SOFT_FLOOR,
  evaluateTrueTarget2028,
  listFormulaTrueTargetSlugs2028,
  resolveFloridaLead,
  floridaIsLeading,
  passesBoardQuality,
};
