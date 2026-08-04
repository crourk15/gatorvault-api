/**
 * Formula-based 2028 true-target auto-include for FutureCast / Desk.
 *
 * Manual ALLOWLIST_2028 remains as a seed/override union. This module adds
 * prospects who clear locked thresholds so high-lead Top-100 chases (e.g.
 * Mannings @ ~92% Florida lead) cannot be invisible due to a missing slug.
 *
 * Locked thresholds (Charles + Vault, 2026-08-04):
 * - Florida lead >= 70% (On3 UF RPM, Rivals PM confidence, or Florida #1 competitor %)
 * - Board quality: national rank <= 100, OR 4-star when national rank is still null (rank lag)
 * - Must remain an active open UF target
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { isActiveUfTarget, isFloridaSchool } = require('./recruiting-target-filters');

const CLASS_YEAR = 2028;
/** Minimum Florida lead % to auto-include. */
const LEAD_PCT_MIN = 70;
/** National rank ceiling for auto-include when ranks are present. */
const NATL_RANK_MAX = 100;

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

  const lead = passesLead(player, opts.rpmBySlug);
  if (!lead.ok) {
    return {
      ok: false,
      reason: 'florida_lead_below_threshold',
      leadPct: lead.pct,
      leadSource: lead.source,
      natlRank: resolveNatlRank(player),
      stars: resolveStars(player),
    };
  }
  if (!passesBoardQuality(player)) {
    return {
      ok: false,
      reason: 'board_quality_below_threshold',
      leadPct: lead.pct,
      leadSource: lead.source,
      natlRank: resolveNatlRank(player),
      stars: resolveStars(player),
    };
  }
  return {
    ok: true,
    reason: 'formula_true_target',
    leadPct: lead.pct,
    leadSource: lead.source,
    natlRank: resolveNatlRank(player),
    stars: resolveStars(player),
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
  evaluateTrueTarget2028,
  listFormulaTrueTargetSlugs2028,
  resolveFloridaLead,
  passesBoardQuality,
};
