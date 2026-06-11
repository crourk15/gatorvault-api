/**
 * Self-Runner 2.0 — War Room intelligence (validation, staleness, missing cards).
 */
const fs = require('fs');
const blueprint = require('./blueprint/canonical-blueprint');
const schemaValidator = require('./schema-validator');
const logger = require('./self-runner-logger');
const patches = require('./self-runner-patches');

const STALE_DAYS = parseInt(process.env.SELF_RUNNER_SCOUTING_STALE_DAYS || '30', 10);

function loadJson(rel) {
  return schemaValidator.readJsonRel(rel);
}

function validateWarRoomEntries() {
  const violations = [];
  const breakdowns = loadJson('data/war-room/breakdowns.json');
  const scoutingDb = loadJson('data/war-room/scouting-database.json');
  const roster = loadJson('data/roster/players.json');
  const recruiting = loadJson('data/recruiting/players.json');

  const rosterSlugs = new Set((roster.data || []).map((p) => p.slug));
  const recruitSlugs = new Set((recruiting.data || []).map((p) => p.slug));
  const breakdownMap = breakdowns.data?.breakdowns || {};

  Object.values(breakdownMap).forEach((entry) => {
    const slug = entry.playerSlug;
    if (!slug) {
      violations.push({ severity: 'high', issue: 'missing_player_slug', entry: entry.playerName });
      return;
    }

    if (entry.playerType === 'roster' && !rosterSlugs.has(slug)) {
      violations.push({
        severity: 'high',
        issue: 'war_room_orphan_roster',
        playerSlug: slug,
        playerName: entry.playerName
      });
    } else if (entry.playerType !== 'roster' && !recruitSlugs.has(slug) && !rosterSlugs.has(slug)) {
      violations.push({
        severity: 'high',
        issue: 'war_room_orphan_recruit',
        playerSlug: slug,
        playerName: entry.playerName
      });
    }

    const hasStructured =
      (entry.strengths?.length || 0) > 0 ||
      (entry.weaknesses?.length || 0) > 0 ||
      entry.projection ||
      entry.comparison;
    if (entry.verified && !hasStructured) {
      violations.push({
        severity: 'medium',
        issue: 'missing_structured_fields',
        playerSlug: slug,
        detail: 'Verified War Room entry missing strengths/weaknesses/projection/comp'
      });
    }

    if (entry.sources?.length) {
      entry.sources.forEach((src) => {
        const writer = src.writer || src.analystName;
        if (!writer) {
          violations.push({ severity: 'medium', issue: 'missing_source_writer', playerSlug: slug });
        }
      });
    }
  });

  const entries = scoutingDb.data?.entries || {};
  Object.values(entries).forEach((entry) => {
    if (!entry.timestamp) {
      violations.push({
        severity: 'medium',
        issue: 'missing_scouting_timestamp',
        playerSlug: entry.playerSlug
      });
    }
    if (entry.sourceType && !['NFL', 'College'].includes(entry.sourceType)) {
      violations.push({
        severity: 'high',
        issue: 'invalid_source_type',
        playerSlug: entry.playerSlug,
        sourceType: entry.sourceType
      });
    }
  });

  return violations;
}

function detectStaleScouting() {
  const scoutingDb = loadJson('data/war-room/scouting-database.json');
  const entries = scoutingDb.data?.entries || {};
  const cutoff = Date.now() - STALE_DAYS * 86400000;
  const stale = [];

  Object.values(entries).forEach((entry) => {
    const ts = new Date(entry.timestamp || entry.lastCheckedAt || 0).getTime();
    if (!ts || ts < cutoff) {
      stale.push({
        playerSlug: entry.playerSlug,
        playerName: entry.playerName,
        playerType: entry.playerType,
        lastUpdate: entry.timestamp || entry.lastCheckedAt,
        daysStale: ts ? Math.floor((Date.now() - ts) / 86400000) : null
      });
    }
  });

  if (stale.length) {
    logger.log.info('stale_scouting_detected', { count: stale.length, staleDays: STALE_DAYS });
  }

  return stale;
}

function detectMissingWarRoomCards() {
  const breakdowns = loadJson('data/war-room/breakdowns.json');
  const roster = loadJson('data/roster/players.json');
  const recruiting = loadJson('data/recruiting/players.json');
  const covered = new Set(Object.keys(breakdowns.data?.breakdowns || {}));
  const missing = [];

  (roster.data || [])
    .filter((p) => p.warRoomFeatured || p.depthChartTier === 'starter')
    .forEach((p) => {
      if (!covered.has(p.slug)) {
        missing.push({
          playerSlug: p.slug,
          playerName: p.name,
          playerType: 'roster',
          reason: p.warRoomFeatured ? 'featured_starter' : 'depth_chart_starter'
        });
      }
    });

  (recruiting.data || [])
    .filter((p) => p.status === 'committed' || p.category === 'commit' || (p.stars || 0) >= 4)
    .forEach((p) => {
      if (!covered.has(p.slug)) {
        missing.push({
          playerSlug: p.slug,
          playerName: p.name,
          playerType: p.category || 'recruit',
          reason: p.status === 'committed' ? 'uf_commit' : 'top_target'
        });
      }
    });

  return missing;
}

function buildWarRoomRefreshPatch(stalePlayers) {
  if (!stalePlayers?.length) return null;
  return {
    patchType: 'war-room-refresh',
    riskLevel: 'low',
    edits: stalePlayers.slice(0, 20).map((p) => ({
      type: 'queue-scouting-refresh',
      playerSlug: p.playerSlug,
      reason: 'self_runner_stale_scouting'
    })),
    suggestedFix: `Queue continuous scouting refresh for ${stalePlayers.length} stale War Room player(s)`
  };
}

function buildMissingCardPatch(missing) {
  if (!missing?.length) return null;
  return {
    patchType: 'war-room-missing-card',
    riskLevel: 'medium',
    edits: missing.slice(0, 10).map((p) => ({
      type: 'queue-scouting-refresh',
      playerSlug: p.playerSlug,
      reason: 'self_runner_missing_war_room_card'
    })),
    suggestedFix: `Add War Room cards for ${missing.length} key player(s) via scouting updater`
  };
}

function runWarRoomIntelligence() {
  const violations = validateWarRoomEntries();
  const stale = detectStaleScouting();
  const missing = detectMissingWarRoomCards();

  violations.forEach((v) => logger.log.issue({ subsystem: 'war-room', ...v }));

  return {
    violations,
    stale,
    missing,
    patches: [buildWarRoomRefreshPatch(stale), buildMissingCardPatch(missing)].filter(Boolean)
  };
}

module.exports = {
  STALE_DAYS,
  validateWarRoomEntries,
  detectStaleScouting,
  detectMissingWarRoomCards,
  runWarRoomIntelligence,
  buildWarRoomRefreshPatch,
  buildMissingCardPatch
};
