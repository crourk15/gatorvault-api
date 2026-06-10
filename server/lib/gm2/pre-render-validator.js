/**
 * GM 2.0 — Pre-Generation / Pre-Render Validator (PGV).
 * Blocks public updates when payload fails integrity checks.
 */
const quarantine = require('./quarantine-store');
const identityValidator = require('../identity-record-validator');
const decisionLog = require('./decision-log');
const { GM2_ACTIONS, GM2_FEATURES } = require('./types');
const rulesEngine = require('./rules-engine');

function extractPlayerSlugs(payload) {
  const slugs = new Set();
  const add = (slug) => {
    if (slug) slugs.add(String(slug).trim());
  };

  if (Array.isArray(payload)) {
    payload.forEach((item) => {
      add(item.playerSlug || item.slug || item.meta?.playerSlug);
      add(item.payload?.player?.slug);
    });
    return slugs;
  }

  if (payload?.bundles) payload.bundles.forEach((b) => add(b.slug));
  if (payload?.rising) payload.rising.forEach((r) => add(r.playerSlug));
  if (payload?.visits) payload.visits.forEach((v) => add(v.playerSlug));
  if (payload?.players) payload.players.forEach((p) => add(p.slug));
  if (payload?.feed) payload.feed.forEach((f) => add(f.meta?.playerSlug));
  if (payload?.events) payload.events.forEach((e) => add(e.playerSlug));
  if (payload?.intel) payload.intel.forEach((i) => add(i.playerSlug));
  add(payload?.playerSlug || payload?.slug);

  return slugs;
}

function detectDuplicatePlayers(payload) {
  if (!Array.isArray(payload)) return [];
  const seen = new Map();
  const dupes = [];
  for (const item of payload) {
    const slug = item.playerSlug || item.slug || item.meta?.playerSlug;
    if (!slug) continue;
    if (seen.has(slug)) dupes.push(slug);
    else seen.set(slug, true);
  }
  return [...new Set(dupes)];
}

/**
 * Validate before a feature updates or renders publicly.
 * @returns {{ pass: boolean, action, reason, errors, blockedSlugs }}
 */
function runPreRenderValidator(feature, payload, options = {}) {
  const errors = [];
  const blockedSlugs = [];
  const sinceTs = options.sinceTs || 0;

  if (options.requireNewSignals && sinceTs > 0) {
    const hasNew = (payload?.signalsAt && new Date(payload.signalsAt).getTime() > sinceTs) ||
      (Array.isArray(payload) && payload.some((i) => {
        const ts = new Date(i.reportedAt || i.createdAt || i.timestamp || 0).getTime();
        return ts > sinceTs;
      }));
    if (!hasNew && options.strictFreshness !== false) {
      errors.push('no_new_signals');
    }
  }

  const slugs = extractPlayerSlugs(payload);
  for (const slug of slugs) {
    if (quarantine.isPlayerQuarantined(slug)) {
      errors.push(`quarantined:${slug}`);
      blockedSlugs.push(slug);
    }
  }

  const dupes = detectDuplicatePlayers(Array.isArray(payload) ? payload : payload?.bundles || payload?.rising || payload?.feed || []);
  if (dupes.length) errors.push(`duplicate_players:${dupes.join(',')}`);

  if (feature === GM2_FEATURES.VISIT_RECAP || feature === GM2_FEATURES.PROGRAM_PULSE) {
    const visitRule = rulesEngine.runRulesEngine(feature, payload?.visits || payload?.signals?.visits || payload);
    if (!visitRule.allow && feature === GM2_FEATURES.VISIT_RECAP) errors.push(visitRule.reason);
  }

  if (feature === GM2_FEATURES.HEAT_CHECK && payload?.rising) {
    for (const player of payload.rising) {
      const r = rulesEngine.runRulesEngine(GM2_FEATURES.HEAT_CHECK, player, { intelRows: payload.intelRows || [] });
      if (!r.allow) errors.push(`heat_check_blocked:${player.playerSlug || player.slug}:${r.reason}`);
    }
  }

  const pass = errors.length === 0;
  const action = pass ? GM2_ACTIONS.ALLOW : GM2_ACTIONS.BLOCK_RENDER;

  decisionLog.logDecision({
    layer: 'pgv',
    action,
    feature,
    reason: pass ? 'pgv_pass' : errors[0],
    errors,
    blockedSlugs,
    itemCount: Array.isArray(payload) ? payload.length : null
  });

  return { pass, action, reason: pass ? 'ok' : errors[0], errors, blockedSlugs };
}

function guardFeatureUpdate(feature, payload, previousPayload, options = {}) {
  const lastRunTs = options.lastRunTs || 0;
  const pgv = runPreRenderValidator(feature, payload, { ...options, sinceTs: lastRunTs, requireNewSignals: options.requireNewSignals });
  if (!pgv.pass) {
    return { updated: false, previous: previousPayload, pgv };
  }
  return { updated: true, payload, pgv };
}

module.exports = {
  runPreRenderValidator,
  guardFeatureUpdate,
  extractPlayerSlugs,
  detectDuplicatePlayers
};
